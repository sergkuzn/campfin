/**
 * Writes for one camp's income: pools, sources and per-diem blocks. Reads live in
 * `src/hooks/useIncome.ts`.
 *
 * Each function is a single transaction, and the rows it must *also* delete come from the
 * pure planners in `src/lib/income.ts` — so "saving a card deletes the block rows the user
 * removed" and "deleting the last source takes its pool with it" are tested without a
 * database, and this file stays a translation from ids to `db.tx` chunks.
 *
 * Every chunk list is built as one array literal with spreads rather than by pushing: the
 * chunks of different namespaces have different types, and an array that starts out holding
 * one namespace refuses the next.
 */

import { id } from '@instantdb/react'
import type { BlockInput, SaveBlocksInput, SaveSourceInput } from '../lib/drafts'
import {
  blockIdsToDelete,
  type IncomeState,
  orphanPoolIds,
  poolCascade,
  sourceBlockIds,
} from '../lib/income'
import { nextPoolColor } from '../lib/poolColors'
import type { IncomeSource, PoolColor } from '../lib/types'
import { chunk, db } from './instant'

/** Upsert one block row. A row without an id is new, so it gets one minted here. */
function blockChunk(campId: string, sourceId: string, block: BlockInput) {
  return chunk(db.tx.perDiemBlocks[block.id ?? id()])
    .update({
      campId,
      sourceId,
      variant: block.variant,
      // null clears the attribute: a label the user emptied must actually go away,
      // otherwise the old one survives the save.
      label: block.label ?? null,
      numPersons: block.numPersons,
      ratePerPersonDayCents: block.ratePerPersonDayCents,
      startDate: block.startDate,
      endDate: block.endDate,
    })
    .link({ camp: campId })
}

/**
 * Create-or-update one income source with its blocks, and its pool if it's new. One
 * transaction, so a half-saved card cannot exist — not on this phone and not on the other.
 *
 * `current` is the camp's rows as the caller sees them right now; it is what makes the
 * removals computable. Ids and timestamps are minted here so `src/lib/` stays pure.
 */
export function saveSource(input: SaveSourceInput, current: IncomeState): Promise<unknown> {
  const now = Date.now()
  const campId = input.campId
  const sourceId = input.existing?.id ?? id()
  const createdAt = input.existing?.createdAt ?? now

  // A pool created by saving a source is never the everyday one — that pool is born with
  // the camp. A deposit gets its own; anything else is earmarked.
  const poolId = input.pool.mode === 'new' ? id() : input.pool.poolId
  const newPool =
    input.pool.mode === 'new'
      ? [
          chunk(db.tx.pools[poolId])
            .update({
              campId,
              name: input.pool.name,
              role: input.kind === 'deposit' ? 'deposit' : 'earmarked',
              // The first hue none of the camp's pools is wearing, so a new pool is
              // distinguishable from its neighbours without anyone choosing.
              color: nextPoolColor(current.pools),
              createdAt: now,
            })
            .link({ camp: campId }),
        ]
      : []

  // Building the domain row first, then deriving the write from it, keeps one definition of
  // "a per-diem source has no stored amount" instead of two that can drift.
  const base = { id: sourceId, campId, poolId, name: input.name, createdAt }
  const source: IncomeSource =
    input.kind === 'per_diem'
      ? { ...base, kind: 'per_diem' }
      : { ...base, kind: input.kind, amountCents: input.amountCents ?? 0 }

  const sourceChunk = chunk(db.tx.incomeSources[sourceId])
    .update(
      source.kind === 'per_diem'
        ? { campId, poolId, kind: source.kind, name: source.name, createdAt }
        : {
            campId,
            poolId,
            kind: source.kind,
            name: source.name,
            createdAt,
            amountCents: source.amountCents,
          },
    )
    .link({ camp: campId })

  // Moving a source to another pool can leave its old pool with nothing in it.
  const sourcesAfter = [...current.sources.filter((s) => s.id !== sourceId), source]

  return db.transact([
    ...newPool,
    sourceChunk,
    ...input.blocks.map((block) => blockChunk(campId, sourceId, block)),
    // Rows the user deleted in the form simply aren't in `input.blocks`. This form only ever
    // shows granted blocks, so the actual-attendance ones are out of its reach.
    ...blockIdsToDelete(
      current.blocks,
      sourceId,
      input.kind === 'per_diem' ? ['granted'] : [],
      input.blocks,
    ).map((blockId) => chunk(db.tx.perDiemBlocks[blockId]).delete()),
    ...orphanPoolIds(current.pools, sourcesAfter).map((orphanId) =>
      chunk(db.tx.pools[orphanId]).delete(),
    ),
  ])
}

/**
 * Replace one variant's block rows for a source — the actual-attendance editor. Nothing
 * else about the source is touched, so the grant the attendance is compared against cannot
 * be rewritten by editing who came.
 *
 * An empty `input.blocks` is a real save, not a no-op: it deletes every block of that
 * variant, which is how "everybody came after all" is expressed.
 */
export function saveBlocks(input: SaveBlocksInput, current: IncomeState): Promise<unknown> {
  const { campId, sourceId, variant } = input

  return db.transact([
    ...input.blocks.map((block) => blockChunk(campId, sourceId, block)),
    ...blockIdsToDelete(current.blocks, sourceId, [variant], input.blocks).map((blockId) =>
      chunk(db.tx.perDiemBlocks[blockId]).delete(),
    ),
  ])
}

/** A source, its blocks, and the pool it leaves empty behind it. */
export function deleteSource(sourceId: string, current: IncomeState): Promise<unknown> {
  const sourcesAfter = current.sources.filter((s) => s.id !== sourceId)

  return db.transact([
    chunk(db.tx.incomeSources[sourceId]).delete(),
    ...sourceBlockIds(current.blocks, sourceId).map((blockId) =>
      chunk(db.tx.perDiemBlocks[blockId]).delete(),
    ),
    ...orphanPoolIds(current.pools, sourcesAfter).map((orphanId) =>
      chunk(db.tx.pools[orphanId]).delete(),
    ),
  ])
}

export function renamePool(poolId: string, name: string): Promise<unknown> {
  return db.transact(chunk(db.tx.pools[poolId]).update({ name }))
}

export function setPoolColor(poolId: string, color: PoolColor): Promise<unknown> {
  return db.transact(chunk(db.tx.pools[poolId]).update({ color }))
}

/**
 * A pool with everything it funded. `poolCascade` returns null for the everyday pool and
 * for an id that isn't there, and this refuses to write anything in that case — the
 * everyday pool is not deletable at any layer.
 */
export function deletePool(poolId: string, current: IncomeState): Promise<unknown> {
  const cascade = poolCascade(current, poolId)
  if (cascade === null) return Promise.resolve()

  return db.transact([
    chunk(db.tx.pools[poolId]).delete(),
    ...cascade.sourceIds.map((sourceId) => chunk(db.tx.incomeSources[sourceId]).delete()),
    ...cascade.blockIds.map((blockId) => chunk(db.tx.perDiemBlocks[blockId]).delete()),
  ])
}
