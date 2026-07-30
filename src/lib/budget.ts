/**
 * Pure budget math. All money is integer cents; euros exist only at the display
 * edge (`formatEuros`).
 */

import { dayCount } from './dates'
import type { Expense, PerDiemBlock, PerDiemVariant } from './types'

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

/** One source's blocks of one variant. Callers never pre-filter, so the two variants
 *  cannot get mixed up by a forgotten `&&`. */
export function blocksOf(
  blocks: PerDiemBlock[],
  sourceId: string,
  variant: PerDiemVariant,
): PerDiemBlock[] {
  return blocks.filter((b) => b.sourceId === sourceId && b.variant === variant)
}

/**
 * The three numbers behind "who actually came", for one per-diem source.
 *
 * `granted` is the money the organisation transferred; `entitled` is what may really be
 * spent, given who turned up. They differ only when `actual` blocks exist — with none, the
 * common case where nobody dropped out costs zero extra rows and actual *is* granted.
 */
export type PerDiemTotals = {
  grantedCents: number
  /** What may actually be spent. Equals granted while the source has no `actual` blocks. */
  entitledCents: number
  /** granted − entitled, floored at 0: money that has to go back unspent. */
  unusableCents: number
  /** entitled − granted, floored at 0. More people came than were funded — a real
   *  situation, so it gets named rather than folded into a negative return. */
  overAttendedCents: number
  /** Whether any `actual` block exists. False means "actual is granted", not "nobody came". */
  hasActual: boolean
}

export function perDiemTotals(blocks: PerDiemBlock[], sourceId: string): PerDiemTotals {
  const grantedCents = perDiemBudgetCents(blocksOf(blocks, sourceId, 'granted'))
  const actual = blocksOf(blocks, sourceId, 'actual')
  const hasActual = actual.length > 0
  const entitledCents = hasActual ? perDiemBudgetCents(actual) : grantedCents

  return {
    grantedCents,
    entitledCents,
    // Both differences are floored, so neither can ever be read as "negative money to
    // return": the two directions are separate, named numbers.
    unusableCents: Math.max(0, grantedCents - entitledCents),
    overAttendedCents: Math.max(0, entitledCents - grantedCents),
    hasActual,
  }
}

/** Σ amountCents of all expenses. */
export function spentTotalCents(expenses: Expense[]): number {
  return expenses.reduce((sum, e) => sum + e.amountCents, 0)
}

/**
 * Format integer cents as a euro string: 212500 → "2.125,00 €". The only place cents
 * become a fractional value. The locale is a parameter, not a constant, because `lib/`
 * must not decide how the UI reads; components go through `useFormat()`. The currency
 * is always EUR — the money is euros whatever language the UI speaks.
 */
export function formatEuros(cents: number, locale = 'de-DE'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}
