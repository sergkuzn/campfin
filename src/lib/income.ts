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
  PoolPolicy,
  PoolRole,
} from './types'

/** Menu order of the "＋ Add income" options. Labels live in the dictionary. */
export const INCOME_KINDS: readonly IncomeKind[] = ['per_diem', 'fixed', 'deposit']

/**
 * Per-diem money is the camp's spine and always feeds the everyday pool; a deposit is
 * returned to one counterparty so it never shares a pool; a fixed grant is the only kind
 * with a real choice.
 */
export function poolPolicyFor(kind: IncomeKind): PoolPolicy {
  switch (kind) {
    case 'per_diem':
      return 'everyday'
    case 'fixed':
      return 'choose'
    case 'deposit':
      return 'own'
    default: {
      const _never: never = kind
      return _never
    }
  }
}

/** Exactly one per-diem source per camp — the menu hides the option once one exists. */
export function hasPerDiemSource(sources: IncomeSource[]): boolean {
  return sources.some((s) => s.kind === 'per_diem')
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
    typeof s.name !== 'string' ||
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
      return typeof m.poolId === 'string'
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

/**
 * Pools nothing feeds any more. A pool nobody funds is not a pool — except the everyday
 * pool, which exists from the camp's birth and outlives every source in it.
 *
 * Callers pass the sources as they will be *after* the write, so the ids come back in time
 * to go into the same transaction.
 */
export function orphanPoolIds(pools: Pool[], sources: IncomeSource[]): string[] {
  const funded = new Set(sources.map((s) => s.poolId))
  return pools.filter((p) => p.role !== 'everyday' && !funded.has(p.id)).map((p) => p.id)
}

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
