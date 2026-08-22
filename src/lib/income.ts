/**
 * Pure income logic: the row guards, the state shape, and the *planners* — the small
 * functions that decide which other rows a write has to take with it. No React, no
 * database, no `Date.now()`.
 *
 * There used to be a reducer here, because local state was the truth. InstantDB owns the
 * truth now, so what survives is the part that was never about state: given the camp's
 * current rows and the write about to happen, which ids must the same transaction delete?
 * That question is pure, and it is exactly where a cascade goes wrong silently.
 */

import type {
  IncomeKind,
  IncomeSource,
  Movement,
  PerDiemBlock,
  PerDiemVariant,
  Pool,
  PoolRole,
} from './types'

/** Exactly one per-diem source per camp — it is the camp's spine, not one grant of many. */
export function hasPerDiemSource(sources: IncomeSource[]): boolean {
  return sources.some((s) => s.kind === 'per_diem')
}

/**
 * Which income kinds a pool can still take. The kind is never asked for as such — the pool
 * a leader is standing in already determines it, and this is where that rule lives so the
 * screen only has to count the answers:
 *
 * - `[]` — nothing more fits, so the pool shows no ＋ at all. A Kaution is one agreement
 *   with one counterparty, so its pool holds exactly one income and then it is full.
 * - one kind — open the form straight away; there is no question to put to the user.
 * - two kinds — the everyday pool before its per-diem grant exists. A leader may want to
 *   park a fixed top-up in the daily pot first, so this is the one place a choice appears.
 *
 * `sources` is the whole camp's list, not the pool's: "one per-diem per camp" is a
 * camp-wide fact, and passing a pre-filtered list would quietly make it per-pool.
 */
export function addableKinds(pool: Pool, sources: IncomeSource[]): IncomeKind[] {
  switch (pool.role) {
    case 'deposit':
      return sources.some((s) => s.poolId === pool.id) ? [] : ['deposit']
    case 'everyday':
      return hasPerDiemSource(sources) ? ['fixed'] : ['per_diem', 'fixed']
    case 'earmarked':
      return ['fixed']
    default: {
      // A fourth role breaks the build here rather than silently offering nothing.
      const _never: never = pool.role
      return _never
    }
  }
}

// --- Naming -------------------------------------------------------------------

/** Case- and space-insensitive, so "Bikes" and " bikes " are not two different names. */
function sameName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase()
}

/**
 * What to call one income. A pool holding a single income needs one name, not two, so the
 * deposit and per-diem forms never ask for one and the pool answers for it. Resolved at
 * read time rather than copied into the row, so renaming the pool renames the income too.
 */
export function sourceLabel(source: IncomeSource, pool: Pool): string {
  const name = source.name?.trim()
  return name === undefined || name === '' ? pool.name : name
}

/**
 * The income's own name, but only when it says something the pool's name doesn't —
 * `undefined` when printing it would just repeat the heading above it. Rows written before
 * the name became optional often duplicate their pool's name verbatim, which is why this
 * compares rather than only checking for absence.
 */
export function distinctSourceName(source: IncomeSource, pool: Pool): string | undefined {
  const name = source.name?.trim()
  if (name === undefined || name === '' || sameName(name, pool.name)) return undefined
  return name
}

// --- Type guards: the door from unknown (a database row) into the typed world ----

function isPoolRole(value: unknown): value is PoolRole {
  return value === 'everyday' || value === 'earmarked' || value === 'deposit'
}

function isPerDiemVariant(value: unknown): value is PerDiemVariant {
  return value === 'granted' || value === 'actual'
}

export function isPool(value: unknown): value is Pool {
  if (typeof value !== 'object' || value === null) return false
  const p = value as Record<string, unknown>
  return (
    typeof p.id === 'string' &&
    typeof p.campId === 'string' &&
    typeof p.name === 'string' &&
    typeof p.createdAt === 'number' &&
    // Deliberately *any* string, not just a known hue: a colour a newer build invented is
    // not worth losing the whole pool over. `toPool` keeps it only if this build can draw
    // it, and the pool falls back to its id-derived hue if not.
    (p.color === undefined || typeof p.color === 'string') &&
    isPoolRole(p.role)
  )
}

export function isIncomeSource(value: unknown): value is IncomeSource {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Record<string, unknown>
  if (
    typeof s.id !== 'string' ||
    typeof s.campId !== 'string' ||
    typeof s.poolId !== 'string' ||
    // Absent for a pool's only income, which is named by its pool.
    (s.name !== undefined && typeof s.name !== 'string') ||
    typeof s.createdAt !== 'number'
  ) {
    return false
  }
  // The guard switches on `kind`, mirroring the discriminated union itself.
  switch (s.kind) {
    case 'per_diem':
      return true
    case 'fixed':
    case 'deposit':
      return typeof s.amountCents === 'number'
    default:
      return false
  }
}

export function isPerDiemBlock(value: unknown): value is PerDiemBlock {
  if (typeof value !== 'object' || value === null) return false
  const b = value as Record<string, unknown>
  return (
    typeof b.id === 'string' &&
    typeof b.campId === 'string' &&
    typeof b.sourceId === 'string' &&
    (b.label === undefined || typeof b.label === 'string') &&
    typeof b.numPersons === 'number' &&
    typeof b.ratePerPersonDayCents === 'number' &&
    typeof b.startDate === 'string' &&
    typeof b.endDate === 'string' &&
    isPerDiemVariant(b.variant)
  )
}

export function isMovement(value: unknown): value is Movement {
  if (typeof value !== 'object' || value === null) return false
  const m = value as Record<string, unknown>
  if (
    typeof m.id !== 'string' ||
    typeof m.campId !== 'string' ||
    typeof m.name !== 'string' ||
    typeof m.amountCents !== 'number' ||
    typeof m.date !== 'string' ||
    (m.note !== undefined && typeof m.note !== 'string') ||
    typeof m.createdAt !== 'number'
  ) {
    return false
  }
  switch (m.kind) {
    case 'deposit_out':
    case 'deposit_in':
      // The union's whole point: a Kaution movement without its pool is not a Movement.
      return (
        typeof m.poolId === 'string' &&
        (m.completesDeposit === undefined || typeof m.completesDeposit === 'boolean')
      )
    case 'volunteer_in':
      return true
    default:
      return false
  }
}

// --- State -------------------------------------------------------------------

/** One camp's income rows — what a live query returns and what the planners read. */
export type IncomeState = {
  pools: Pool[]
  sources: IncomeSource[]
  blocks: PerDiemBlock[]
}

export const emptyIncome: IncomeState = { pools: [], sources: [], blocks: [] }

// --- Planners: which rows a write must delete alongside itself ----------------

/** Blocks belong to their source, so they die with it — both variants. */
export function sourceBlockIds(blocks: PerDiemBlock[], sourceId: string): string[] {
  return blocks.filter((b) => b.sourceId === sourceId).map((b) => b.id)
}

/**
 * Saving a block editor replaces the rows it showed: whatever the user removed simply isn't
 * in `kept`, so it has to be deleted.
 *
 * `variants` says which rows were on the form, and it is a separate argument rather than
 * something read off `kept`: clearing the actual-attendance editor saves *nothing*, and
 * "no rows kept" must still delete the rows that were there. Deriving the scope from the
 * kept rows would make an empty save a silent no-op. Rows whose `id` is null are new and
 * delete nothing.
 */
export function blockIdsToDelete(
  blocks: PerDiemBlock[],
  sourceId: string,
  variants: readonly PerDiemVariant[],
  kept: readonly { id: string | null }[],
): string[] {
  const scope = new Set(variants)
  const keptIds = new Set(kept.map((k) => k.id).filter((id): id is string => id !== null))
  return blocks
    .filter((b) => b.sourceId === sourceId && scope.has(b.variant) && !keptIds.has(b.id))
    .map((b) => b.id)
}

/**
 * Deleting a pool takes its sources and their blocks with it. `null` means *do not delete
 * this pool at all*: the everyday pool exists from the camp's birth and the UI hides its
 * delete button, and this is the backstop that keeps "exactly one per camp" true regardless
 * of who calls it. `null` and "nothing inside" are different answers, so they get different
 * return values rather than an empty list that a caller could mistake for permission.
 */
export function poolCascade(
  state: IncomeState,
  poolId: string,
): { sourceIds: string[]; blockIds: string[] } | null {
  const pool = state.pools.find((p) => p.id === poolId)
  if (pool === undefined || pool.role === 'everyday') return null

  const sourceIds = state.sources.filter((s) => s.poolId === poolId).map((s) => s.id)
  // A Set makes the block filter one lookup per row rather than a scan per source.
  const doomed = new Set(sourceIds)
  return {
    sourceIds,
    blockIds: state.blocks.filter((b) => doomed.has(b.sourceId)).map((b) => b.id),
  }
}
