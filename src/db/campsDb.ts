/**
 * Writes for camps and memberships. Reads live in `src/hooks/useCamps.ts`, where the query
 * object keeps its inferred type.
 *
 * Every write is one `db.transact` call: a transaction is atomic, so a camp can never exist
 * without its everyday pool or without the membership that makes it visible. Writes land in
 * the local store immediately and sync in the background, which is why the callers here are
 * synchronous from the UI's point of view — the returned promise is only for reporting a
 * *rejection* (a permission rule said no, a unique join code collided).
 */

import { id } from '@instantdb/react'
import { type CampDump, remapCampExport } from '../lib/importJson'
import { nextPoolColor } from '../lib/poolColors'
import type { Camp, MemberRole } from '../lib/types'
import { chunk, db } from './instant'

type CreateCampArgs = {
  name: string
  joinCode: string
  userId: string
  now: number
  /** Comes from the dictionary at creation time, then owned by the user. */
  everydayPoolName: string
}

/**
 * The camp, its everyday pool and the creator's admin membership, in one transaction.
 *
 * Returns the camp *before* the write resolves so the caller can navigate straight into it.
 * If the transaction is rejected — a join-code collision is the realistic case — Instant
 * rolls the optimistic rows back and the open camp simply stops existing, which the screen
 * already handles by falling back to the list.
 */
export function createCamp(args: CreateCampArgs): { camp: Camp; done: Promise<unknown> } {
  const { name, joinCode, userId, now, everydayPoolName } = args
  const campId = id()

  const done = db.transact([
    chunk(db.tx.camps[campId]).update({ name, joinCode, createdAt: now }),
    chunk(db.tx.pools[id()])
      // The camp's first pool takes the first hue; every pool added later picks the next
      // one nobody is using.
      .update({
        campId,
        name: everydayPoolName,
        role: 'everyday',
        color: nextPoolColor([]),
        createdAt: now,
      })
      .link({ camp: campId }),
    membershipChunk({ campId, userId, role: 'admin', now }),
  ])

  return { camp: { id: campId, name, joinCode, createdAt: now }, done }
}

type ImportCampArgs = {
  /** As parsed from the file — old ids and all. Remapped here, where ids are minted. */
  parsed: CampDump
  /** Already made unique against the user's other camps by `uniqueCampName`. */
  name: string
  joinCode: string
  userId: string
  now: number
}

/**
 * A whole camp restored from a JSON dump, in one transaction: the camp, the importer's
 * admin membership, and every pool, source, block, receipt and movement it carried.
 *
 * Like `createCamp`, the camp comes back before the write resolves so the caller can open
 * it at once. Atomic, because a half-restored camp would settle to the wrong total.
 */
export function importCamp(args: ImportCampArgs): { camp: Camp; done: Promise<unknown> } {
  const { parsed, name, joinCode, userId, now } = args
  // Fresh ids for every row, so a dump can be restored next to the camp it came from
  // without the two overwriting each other.
  const dump = remapCampExport(parsed, { campId: id(), joinCode, name, newId: id })
  const campId = dump.camp.id

  const done = db.transact([
    chunk(db.tx.camps[campId]).update({
      name: dump.camp.name,
      joinCode: dump.camp.joinCode,
      createdAt: dump.camp.createdAt,
    }),
    membershipChunk({ campId, userId, role: 'admin', now }),

    ...dump.pools.map((pool) =>
      chunk(db.tx.pools[pool.id])
        .update({
          campId,
          name: pool.name,
          role: pool.role,
          color: pool.color,
          createdAt: pool.createdAt,
        })
        .link({ camp: campId }),
    ),

    ...dump.sources.map((source) =>
      chunk(db.tx.incomeSources[source.id])
        .update(
          // Narrowing on `kind` is what keeps `amountCents` off a per-diem source, whose
          // amount is computed from its blocks and never stored.
          source.kind === 'per_diem'
            ? {
                campId,
                poolId: source.poolId,
                kind: source.kind,
                name: source.name,
                createdAt: source.createdAt,
              }
            : {
                campId,
                poolId: source.poolId,
                kind: source.kind,
                name: source.name,
                amountCents: source.amountCents,
                createdAt: source.createdAt,
              },
        )
        .link({ camp: campId }),
    ),

    ...dump.blocks.map((block) =>
      chunk(db.tx.perDiemBlocks[block.id])
        .update({
          campId,
          sourceId: block.sourceId,
          variant: block.variant,
          label: block.label,
          numPersons: block.numPersons,
          ratePerPersonDayCents: block.ratePerPersonDayCents,
          startDate: block.startDate,
          endDate: block.endDate,
        })
        .link({ camp: campId }),
    ),

    ...dump.expenses.map((expense) =>
      chunk(db.tx.expenses[expense.id])
        .update({
          campId,
          poolId: expense.poolId,
          name: expense.name,
          amountCents: expense.amountCents,
          date: expense.date,
          number: expense.number,
          note: expense.note,
          enteredBy: expense.enteredBy,
          createdAt: expense.createdAt,
        })
        .link({ camp: campId }),
    ),

    ...dump.movements.map((movement) =>
      chunk(db.tx.movements[movement.id])
        .update({
          campId,
          kind: movement.kind,
          // Volunteer money has no pool at all; the union in `src/lib/types.ts` is what
          // makes reading `poolId` here a compile error unless the kind was narrowed.
          poolId: movement.kind === 'volunteer_in' ? undefined : movement.poolId,
          completesDeposit:
            movement.kind === 'deposit_out' ? (movement.completesDeposit ?? false) : undefined,
          name: movement.name,
          amountCents: movement.amountCents,
          date: movement.date,
          note: movement.note,
          createdAt: movement.createdAt,
        })
        .link({ camp: campId }),
    ),
  ])

  return { camp: dump.camp, done }
}

export function renameCamp(campId: string, name: string): Promise<unknown> {
  return db.transact(chunk(db.tx.camps[campId]).update({ name }))
}

/**
 * Name the leader who holds the camp's cash, or pass null so nobody does.
 *
 * No receipt is rewritten: who owes whom is derived from this name at render time, which
 * is what lets one write flip every debt in the camp at once.
 */
export function setMoneyHolder(campId: string, name: string | null): Promise<unknown> {
  return db.transact(chunk(db.tx.camps[campId]).update({ moneyHolder: name }))
}

/**
 * Deletes the camp and, through `onDelete: 'cascade'` on every row's `camp` link, its
 * pools, income, blocks, receipts, movements and memberships — server-side, in one step,
 * rather than the client walking six namespaces and hoping it finishes.
 */
export function deleteCamp(campId: string): Promise<unknown> {
  return db.transact(chunk(db.tx.camps[campId]).delete())
}

/**
 * Join a camp whose code the user typed. `joinCode` rides along as a rule param because
 * that code is the whole authorisation: it is what `camps.view` accepts from someone who
 * is not a member yet.
 */
export function joinCamp(args: {
  campId: string
  joinCode: string
  userId: string
  now: number
}): Promise<unknown> {
  const { campId, joinCode, userId, now } = args
  return db.transact(
    membershipChunk({ campId, userId, role: 'editor', now }).ruleParams({ joinCode }),
  )
}

/**
 * A membership row plus its two links. `user` points at the `$users` row, which is what the
 * permission rules traverse — `userId` is the copy the UI reads, since it may not query
 * other people's user rows.
 */
function membershipChunk(args: { campId: string; userId: string; role: MemberRole; now: number }) {
  const { campId, userId, role, now } = args
  return chunk(db.tx.memberships[id()])
    .update({ campId, userId, role, createdAt: now })
    .link({ camp: campId, user: userId })
}
