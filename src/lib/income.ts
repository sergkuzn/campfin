/**
 * Pure income logic: type guards for the persisted row types, the state shape, and
 * the reducer that owns every transition. No React, no storage, no Date.now().
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

// --- Type guards: the door from unknown (JSON.parse) into the typed world ----

function isPoolRole(value: unknown): value is PoolRole {
  return value === 'everyday' || value === 'earmarked' || value === 'deposit'
}

function isPerDiemVariant(value: unknown): value is PerDiemVariant {
  return value === 'granted' || value === 'actual'
}

export function isPool(value: unknown): value is Pool {
  if (!isLegacyPool(value)) return false
  return isPoolRole(value.role)
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
  if (!isLegacyBlock(value)) return false
  return isPerDiemVariant(value.variant)
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

// --- Migration: rows written before pools had roles and blocks had variants -----
// The legacy shapes are the current ones minus the new field, so `role`/`variant` are
// optional on the way in and filled in below. Reading them is the only place in the app
// that may see a pool without a role.

export type LegacyPool = Omit<Pool, 'role'> & { role?: PoolRole }
export type LegacyBlock = Omit<PerDiemBlock, 'variant'> & { variant?: PerDiemVariant }

export function isLegacyPool(value: unknown): value is LegacyPool {
  if (typeof value !== 'object' || value === null) return false
  const p = value as Record<string, unknown>
  return (
    typeof p.id === 'string' &&
    typeof p.campId === 'string' &&
    typeof p.name === 'string' &&
    typeof p.createdAt === 'number' &&
    (p.role === undefined || isPoolRole(p.role))
  )
}

export function isLegacyBlock(value: unknown): value is LegacyBlock {
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
    (b.variant === undefined || isPerDiemVariant(b.variant))
  )
}

/**
 * Give every pool a role, derived from what feeds it: per-diem money makes the everyday
 * pot, a Kaution makes a deposit pool, anything else is earmarked. A role already on the
 * row wins — the derivation is a one-time repair, not a rule.
 *
 * A camp whose pools yield no everyday pool is *not* fixed here: minting an id is not
 * something a pure function may do. `useIncome.ensureEverydayPools` covers that.
 */
export function upgradePools(pools: LegacyPool[], sources: IncomeSource[]): Pool[] {
  return pools.map((pool) => {
    if (pool.role !== undefined) return { ...pool, role: pool.role }
    const kinds = new Set(sources.filter((s) => s.poolId === pool.id).map((s) => s.kind))
    const role: PoolRole = kinds.has('per_diem')
      ? 'everyday'
      : kinds.has('deposit')
        ? 'deposit'
        : 'earmarked'
    return { ...pool, role }
  })
}

/** Blocks written before the granted/actual split are what the organisation granted. */
export function upgradeBlocks(blocks: LegacyBlock[]): PerDiemBlock[] {
  return blocks.map((block) => ({ ...block, variant: block.variant ?? 'granted' }))
}

// --- State + actions ---------------------------------------------------------

export type IncomeState = {
  pools: Pool[]
  sources: IncomeSource[]
  blocks: PerDiemBlock[]
}

export const emptyIncome: IncomeState = { pools: [], sources: [], blocks: [] }

export type IncomeAction =
  | { type: 'loaded'; state: IncomeState }
  /** Create-or-replace one source together with its blocks, and optionally the new
   *  pool it goes into. Whole-row replace, not a patch: it is idempotent, and it is
   *  exactly what InstantDB's last-write-wins merge will do in milestone 4. */
  | { type: 'sourceSaved'; source: IncomeSource; blocks: PerDiemBlock[]; pool?: Pool }
  | { type: 'sourceDeleted'; sourceId: string }
  | { type: 'poolRenamed'; poolId: string; name: string }
  | { type: 'poolDeleted'; poolId: string }
  /** Give the named camps their everyday pool. One per camp, enforced below. */
  | { type: 'everydayPoolsEnsured'; pools: Pool[] }

/**
 * A pool nobody feeds is not a pool — except the everyday pool, which exists from the
 * camp's birth and outlives every source in it. Returning the *same* state object when
 * nothing changed matters: useReducer bails out of the re-render, and the persistence
 * effect in useIncome doesn't fire a pointless write.
 */
function dropEmptyPools(state: IncomeState): IncomeState {
  const used = new Set(state.sources.map((s) => s.poolId))
  const pools = state.pools.filter((p) => p.role === 'everyday' || used.has(p.id))
  return pools.length === state.pools.length ? state : { ...state, pools }
}

export function incomeReducer(state: IncomeState, action: IncomeAction): IncomeState {
  switch (action.type) {
    case 'loaded':
      return action.state

    case 'sourceSaved': {
      const exists = state.sources.some((s) => s.id === action.source.id)
      return dropEmptyPools({
        pools: action.pool === undefined ? state.pools : [...state.pools, action.pool],
        sources: exists
          ? state.sources.map((s) => (s.id === action.source.id ? action.source : s))
          : [...state.sources, action.source],
        // Replace-all rather than merge: rows the user deleted in the form simply
        // aren't in action.blocks, so Save commits the whole card atomically.
        blocks: [...state.blocks.filter((b) => b.sourceId !== action.source.id), ...action.blocks],
      })
    }

    case 'sourceDeleted': {
      // Cascade: blocks belong to their source, so they die with it. Leaving them
      // behind would keep money in the totals that no source accounts for.
      return dropEmptyPools({
        pools: state.pools,
        sources: state.sources.filter((s) => s.id !== action.sourceId),
        blocks: state.blocks.filter((b) => b.sourceId !== action.sourceId),
      })
    }

    case 'poolRenamed':
      return {
        ...state,
        pools: state.pools.map((p) => (p.id === action.poolId ? { ...p, name: action.name } : p)),
      }

    case 'everydayPoolsEnsured': {
      // Idempotent on purpose: a camp that already has an everyday pool is skipped, so
      // dispatching this twice — which React does in development, where it runs every
      // effect twice to surface exactly this class of bug — cannot mint a second one.
      const covered = new Set(state.pools.filter((p) => p.role === 'everyday').map((p) => p.campId))
      const added: Pool[] = []
      for (const pool of action.pools) {
        if (covered.has(pool.campId)) continue
        covered.add(pool.campId)
        added.push(pool)
      }
      return added.length === 0 ? state : { ...state, pools: [...state.pools, ...added] }
    }

    case 'poolDeleted': {
      // The everyday pool is not deletable — the UI hides the button, and this is the
      // backstop that keeps the "exactly one per camp" invariant true regardless.
      const target = state.pools.find((p) => p.id === action.poolId)
      if (target === undefined || target.role === 'everyday') return state

      // Deleting a pool takes its sources and their blocks with it. Collecting the
      // doomed ids into a Set first keeps the block filter O(1) per row and readable.
      const doomed = new Set(
        state.sources.filter((s) => s.poolId === action.poolId).map((s) => s.id),
      )
      return {
        pools: state.pools.filter((p) => p.id !== action.poolId),
        sources: state.sources.filter((s) => s.poolId !== action.poolId),
        blocks: state.blocks.filter((b) => !doomed.has(b.sourceId)),
      }
    }

    default: {
      const _never: never = action
      return _never
    }
  }
}

/** The slice of income belonging to one camp — what a screen actually renders. */
export function campSlice(state: IncomeState, campId: string): IncomeState {
  return {
    pools: state.pools.filter((p) => p.campId === campId),
    sources: state.sources.filter((s) => s.campId === campId),
    blocks: state.blocks.filter((b) => b.campId === campId),
  }
}
