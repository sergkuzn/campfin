/**
 * Pure budget math. All money is integer cents; euros exist only at the display
 * edge (`formatEuros`).
 */

import { dayCount } from './dates'
import type { Contribution, Expense, FixedGrantSource, IncomeSource, PerDiemBlock } from './types'

/** Total funded per-diem money = Σ people × rate × inclusive day count, per block. */
export function perDiemBudgetCents(blocks: PerDiemBlock[]): number {
  let sum = 0
  blocks.forEach((block) => {
    sum =
      sum +
      block.numPersons * dayCount(block.startDate, block.endDate) * block.ratePerPersonDayCents
  })
  return sum
}

/** Σ fixedAmountCents of the fixed grants matching `use`. */
export function fixedGrantTotalCents(sources: IncomeSource[], use: 'gradual' | 'reserved'): number {
  return sources
    .filter((s): s is FixedGrantSource => s.kind === 'fixed' && s.use === use)
    .reduce((sum, s) => sum + s.fixedAmountCents, 0)
}

/** Σ amountCents of all pass-through contributions. */
export function passthroughTotalCents(contributions: Contribution[]): number {
  return contributions.reduce((sum, c) => sum + c.amountCents, 0)
}

/** Σ amountCents of all expenses (gradual + reserved). */
export function spentTotalCents(expenses: Expense[]): number {
  return expenses.reduce((sum, e) => sum + e.amountCents, 0)
}

/**
 * Remaining money in one reserved pot: its grant minus everything spent against
 * it. Negative when overspent; callers floor it before reporting a return.
 */
export function reservedRemainingCents(source: FixedGrantSource, expenses: Expense[]): number {
  const spent = expenses
    .filter((e) => e.sourceId === source.id)
    .reduce((sum, e) => sum + e.amountCents, 0)
  return source.fixedAmountCents - spent
}

/**
 * Format integer cents as a euro string: 212500 → "2.125,00 €". The only place
 * cents become a fractional value.
 */
export function formatEuros(cents: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}
