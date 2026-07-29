/**
 * End-of-camp settlement: what was received, what was spent, what goes back.
 * Composes the pool math; kept separate so pools.ts stays a flat toolbox.
 */

import { spentTotalCents } from './budget'
import { type PoolSummary, receivedTotalCents, summarisePools, toReturnCents } from './pools'
import type { Expense, IncomeSource, PerDiemBlock, Pool } from './types'

export type Settlement = {
  receivedTotalCents: number
  spentTotalCents: number
  /** The amount actually wired back: Σ per-pool leftover, floored at 0 each. */
  toReturnCents: number
  /** Per-pool detail, rendered directly by the dashboard. */
  pools: PoolSummary[]
}

export function computeSettlement(
  pools: Pool[],
  sources: IncomeSource[],
  blocks: PerDiemBlock[],
  expenses: Expense[],
): Settlement {
  // Summarised once and read three times: two passes could disagree if the inputs
  // were ever mutated between them, which would be a correctness bug, not just slow.
  const summaries = summarisePools(pools, sources, blocks, expenses)

  return {
    receivedTotalCents: receivedTotalCents(summaries),
    spentTotalCents: spentTotalCents(expenses),
    toReturnCents: toReturnCents(summaries),
    pools: summaries,
  }
}
