/**
 * Budget math for the per-diem funding pot.
 *
 * RULES (see CLAUDE.md → "Golden rules"):
 *  - All money is INTEGER CENTS. Never store or compute currency as floating
 *    euros — `0.1 + 0.2 !== 0.3` in JS, and a budget tool must not lose cents.
 *  - These are PURE functions: plain data in, numbers out, no React, no DB, no
 *    side effects. That's what makes them trivially unit-testable (see budget.test.ts).
 */

/** Inputs needed to size the funded per-diem budget. */
export type PerDiemConfig = {
  /** Funded rate per person per day, in whole cents (e.g. €12.50 → 1250). */
  ratePerPersonDayCents: number
  numParticipants: number
  numLeaders: number
  /** Participant camp length, in days. */
  numDays: number
  /** Days leaders arrive before participants — they draw per-diem for these too. */
  leaderLeadDays: number
}

/**
 * Total person-days the funder pays for: every participant across the camp
 * length, plus every leader across the camp length AND their early lead days.
 */
export function basePersonDays(c: PerDiemConfig): number {
  return c.numParticipants * c.numDays + c.numLeaders * (c.numDays + c.leaderLeadDays)
}

/** Funded per-diem budget, in cents = rate × total person-days. */
export function perDiemBudgetCents(c: PerDiemConfig): number {
  return c.ratePerPersonDayCents * basePersonDays(c)
}

/**
 * Format an integer-cent amount as a localized euro string. This is the ONLY
 * place cents become a fractional euro value — the display edge. German locale
 * to match the target users (e.g. 212500 → "2.125,00 €").
 */
export function formatEuros(cents: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}
