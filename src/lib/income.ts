/**
 * Pure income logic: type guards for the three persisted row types, the state shape,
 * and the reducer that owns every transition. No React, no storage, no Date.now().
 */

import type { Contribution, IncomeSource, PerDiemBlock } from './types'

// --- Type guards: the door from unknown (JSON.parse) into the typed world ----

export function isIncomeSource(value: unknown): value is IncomeSource {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Record<string, unknown>
  if (
    typeof s.id !== 'string' ||
    typeof s.campId !== 'string' ||
    typeof s.name !== 'string' ||
    typeof s.createdAt !== 'number'
  ) {
    return false
  }
  // The guard switches on `kind`, mirroring the discriminated union itself.
  switch (s.kind) {
    case 'per_diem':
      return s.use === 'gradual'
    case 'fixed':
      return (s.use === 'gradual' || s.use === 'reserved') && typeof s.fixedAmountCents === 'number'
    case 'passthrough':
      return s.use === 'passthrough'
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

export function isContribution(value: unknown): value is Contribution {
  if (typeof value !== 'object' || value === null) return false
  const c = value as Record<string, unknown>
  return (
    typeof c.id === 'string' &&
    typeof c.campId === 'string' &&
    typeof c.sourceId === 'string' &&
    typeof c.name === 'string' &&
    typeof c.amountCents === 'number' &&
    typeof c.date === 'string' &&
    typeof c.createdAt === 'number'
  )
}

// --- State + actions ---------------------------------------------------------

export type IncomeState = {
  sources: IncomeSource[]
  blocks: PerDiemBlock[]
  contributions: Contribution[]
}

export const emptyIncome: IncomeState = { sources: [], blocks: [], contributions: [] }

export type IncomeAction =
  | { type: 'loaded'; state: IncomeState }
  | { type: 'sourceAdded'; source: IncomeSource }
  | { type: 'sourceDeleted'; sourceId: string }
  | { type: 'blockAdded'; block: PerDiemBlock }
  | { type: 'blockDeleted'; blockId: string }
  | { type: 'contributionAdded'; contribution: Contribution }
  | { type: 'contributionDeleted'; contributionId: string }

export function incomeReducer(state: IncomeState, action: IncomeAction): IncomeState {
  switch (action.type) {
    case 'loaded':
      return action.state
    case 'sourceAdded':
      return { ...state, sources: [...state.sources, action.source] }

    case 'sourceDeleted': {
      // Cascade: blocks and contributions belong to their source, so they die with it.
      // Leaving them behind would keep money in the totals that no source accounts for.
      return {
        sources: state.sources.filter((s) => s.id !== action.sourceId),
        blocks: state.blocks.filter((b) => b.sourceId !== action.sourceId),
        contributions: state.contributions.filter((c) => c.sourceId !== action.sourceId),
      }
    }

    case 'blockAdded':
      return { ...state, blocks: [...state.blocks, action.block] }
    case 'blockDeleted':
      return { ...state, blocks: state.blocks.filter((b) => b.id !== action.blockId) }
    case 'contributionAdded':
      return { ...state, contributions: [...state.contributions, action.contribution] }
    case 'contributionDeleted':
      return {
        ...state,
        contributions: state.contributions.filter((c) => c.id !== action.contributionId),
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
    sources: state.sources.filter((s) => s.campId === campId),
    blocks: state.blocks.filter((b) => b.campId === campId),
    contributions: state.contributions.filter((c) => c.campId === campId),
  }
}
