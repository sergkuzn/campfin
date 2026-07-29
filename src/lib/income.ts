/**
 * Pure income logic: type guards for the persisted row types, the state shape, and
 * the reducer that owns every transition. No React, no storage, no Date.now().
 */

import type { IncomeSource, PerDiemBlock, Pool } from './types'

// --- Type guards: the door from unknown (JSON.parse) into the typed world ----

export function isPool(value: unknown): value is Pool {
  if (typeof value !== 'object' || value === null) return false
  const p = value as Record<string, unknown>
  return (
    typeof p.id === 'string' &&
    typeof p.campId === 'string' &&
    typeof p.name === 'string' &&
    typeof p.createdAt === 'number'
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
    typeof b.endDate === 'string'
  )
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

/**
 * A pool nobody feeds is not a pool. Returning the *same* state object when nothing
 * changed matters: useReducer bails out of the re-render, and the persistence effect
 * in useIncome doesn't fire a pointless write.
 */
function dropEmptyPools(state: IncomeState): IncomeState {
  const used = new Set(state.sources.map((s) => s.poolId))
  const pools = state.pools.filter((p) => used.has(p.id))
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

    case 'poolDeleted': {
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
