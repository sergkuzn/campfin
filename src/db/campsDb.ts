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
import type { Camp, MemberRole } from '../lib/types'
import { chunk, db } from './instant'

type CreateCampArgs = {
  name: string
  joinCode: string
  userId: string
  now: number
  /** Comes from the dictionary at creation time, then owned by the user (plan §3.4). */
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
      .update({ campId, name: everydayPoolName, role: 'everyday', createdAt: now })
      .link({ camp: campId }),
    membershipChunk({ campId, userId, role: 'admin', now }),
  ])

  return { camp: { id: campId, name, joinCode, createdAt: now }, done }
}

export function renameCamp(campId: string, name: string): Promise<unknown> {
  return db.transact(chunk(db.tx.camps[campId]).update({ name }))
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
