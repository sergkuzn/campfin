/**
 * Pool-level money math: what each pot was funded with, spent, and has left.
 * Pure — no React, no storage. All amounts are integer cents.
 */

import { perDiemBudgetCents } from './budget'
import type { Expense, IncomeSource, PerDiemBlock, Pool } from './types'

/** One pool with its sources and its three totals — what a screen renders. */
export type PoolSummary = {
  pool: Pool
  sources: IncomeSource[]
  fundedCents: number
  spentCents: number
  /** funded − spent. Negative when the pool is overspent; callers floor it. */
  remainingCents: number
}

/**
 * What one source contributes. `allBlocks` is the whole block list — the function
 * picks out the ones belonging to this source, so callers never pre-filter.
 */
export function sourceAmountCents(source: IncomeSource, allBlocks: PerDiemBlock[]): number {
  switch (source.kind) {
    case 'per_diem':
      // Granted blocks only: that is the money that actually arrived. Actual-attendance
      // blocks describe what may be *spent*, which is a different number (stage 09).
      return perDiemBudgetCents(
        allBlocks.filter((b) => b.sourceId === source.id && b.variant === 'granted'),
      )
    case 'fixed':
    case 'deposit':
      // Only after narrowing does TypeScript know `amountCents` exists at all.
      return source.amountCents
    default: {
      // Exhaustiveness guard: a fourth kind breaks the build here rather than
      // silently contributing 0 to every total.
      const _never: never = source
      return _never
    }
  }
}

/** Every pool of one camp, in creation order, with its sources and totals. */
export function summarisePools(
  pools: Pool[],
  sources: IncomeSource[],
  blocks: PerDiemBlock[],
  expenses: Expense[],
): PoolSummary[] {
  return pools.map((pool) => {
    const poolSources = sources.filter((s) => s.poolId === pool.id)
    const fundedCents = poolSources.reduce((sum, s) => sum + sourceAmountCents(s, blocks), 0)
    const spentCents = expenses
      .filter((e) => e.poolId === pool.id)
      .reduce((sum, e) => sum + e.amountCents, 0)

    // Not floored: the dashboard wants to show an overspend in red, and settlement
    // does its own flooring where a return amount is actually needed.
    return {
      pool,
      sources: poolSources,
      fundedCents,
      spentCents,
      remainingCents: fundedCents - spentCents,
    }
  })
}

/**
 * The camp's daily pot. Every camp has exactly one, created with the camp — but this
 * returns `undefined` anyway, because a freshly migrated camp may not have got its pool
 * back yet, and a lie in a return type is worse than a branch at two call sites.
 */
export function everydayPool(pools: Pool[], campId: string): Pool | undefined {
  return pools.find((p) => p.campId === campId && p.role === 'everyday')
}

/** Σ funded across pools — "received so far". */
export function receivedTotalCents(summaries: PoolSummary[]): number {
  return summaries.reduce((sum, s) => sum + s.fundedCents, 0)
}

/** Σ what actually goes back: each pool's leftover, floored at 0 (overspend returns nothing). */
export function toReturnCents(summaries: PoolSummary[]): number {
  // Flooring per pool, not on the sum: overspending the bike pool must not eat the
  // leftover in the everyday pool.
  return summaries.reduce((sum, s) => sum + Math.max(0, s.remainingCents), 0)
}
