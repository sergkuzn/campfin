/**
 * Pure budget math. All money is integer cents; euros exist only at the display
 * edge (`formatEuros`).
 */

import { dayCount } from './dates'
import type { Expense, PerDiemBlock } from './types'

/** One block's size in person-days: people × inclusive days — the quantity the rate buys. */
export function blockPersonDays(numPersons: number, startDate: string, endDate: string): number {
  return numPersons * dayCount(startDate, endDate)
}

/** One block's money: people × inclusive days × rate. The people×days×rate rule lives here. */
export function blockCents(
  numPersons: number,
  ratePerPersonDayCents: number,
  startDate: string,
  endDate: string,
): number {
  return numPersons * dayCount(startDate, endDate) * ratePerPersonDayCents
}

/** Total funded per-diem money = Σ over blocks. */
export function perDiemBudgetCents(blocks: PerDiemBlock[]): number {
  return blocks.reduce(
    (sum, b) => sum + blockCents(b.numPersons, b.ratePerPersonDayCents, b.startDate, b.endDate),
    0,
  )
}

/** Σ amountCents of all expenses. */
export function spentTotalCents(expenses: Expense[]): number {
  return expenses.reduce((sum, e) => sum + e.amountCents, 0)
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
