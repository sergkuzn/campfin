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

/** Pools a receipt may consume from, and the ones that get a spent/left bar. A deposit
 *  is somebody else's money passing through; it gets its own strip in a later stage. */
export function spendablePools(summaries: PoolSummary[]): PoolSummary[] {
  return summaries.filter((s) => s.pool.role !== 'deposit')
}

/** How full a pool's bar is. `empty` = nothing funded and nothing spent — the bar is a
 *  placeholder, not a measurement. */
export type PoolBarState = 'empty' | 'ok' | 'warn' | 'over'

export type PoolBar = {
  state: PoolBarState
  /** 0–100: the filled part of the track, clamped so it never runs past the end. */
  fillPercent: number
  /** 0–100 of the track, drawn *past* the end. 0 unless overspent. */
  overPercent: number
}

/** Amber from here on: three quarters gone is the point where a leader should look. */
const WARN_RATIO = 0.75

/**
 * The geometry and the colour of one pool's bar. Returned as numbers rather than drawn
 * as CSS, so "an overspent pool is red and the excess is visible" is a tested fact
 * instead of a styling accident — clipping the fill at 100% would make the bar lie.
 */
export function poolBar(fundedCents: number, spentCents: number): PoolBar {
  if (fundedCents <= 0) {
    // Nothing funded: spending from such a pool is entirely overspend. A percentage of
    // zero has no meaning, so the ratio is skipped rather than divided by zero.
    return spentCents <= 0
      ? { state: 'empty', fillPercent: 0, overPercent: 0 }
      : { state: 'over', fillPercent: 0, overPercent: 100 }
  }

  const ratio = spentCents / fundedCents
  if (ratio > 1) {
    return {
      state: 'over',
      fillPercent: 100,
      // Capped: one mistyped receipt must not stretch the row off a phone screen.
      overPercent: Math.min(100, Math.round((ratio - 1) * 100)),
    }
  }

  return {
    state: ratio >= WARN_RATIO ? 'warn' : 'ok',
    fillPercent: Math.round(ratio * 100),
    overPercent: 0,
  }
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
