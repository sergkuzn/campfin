/**
 * The time dimension: how much of the camp's money each day is allowed to consume, and
 * how the real spending compares. Pure — no React, no database, no clock. "Today" is
 * always passed in, so every curve in here is reproducible in a test.
 *
 * Only the everyday pool has a curve. An earmarked grant is spent when its purpose comes
 * up, not at a daily rate, and a deposit is somebody else's money passing through — both
 * would make the line meaningless.
 */

import { type CampWindow, campWindow, realityBlocks } from './camps'
import { eachDay, isWithin } from './dates'
import type { Expense, IncomeSource, PerDiemBlock } from './types'

/** One calendar day of the chart. Both series live on the same row because that is
 *  exactly the shape a Recharts `LineChart` takes as its `data`. */
export type BurnPoint = {
  date: string
  /** Day of the month, no leading zero — the axis of a 14-day camp on a phone. */
  dayLabel: string
  /** That day's allowance on its own. The non-cumulative view is deferred, but the
   *  number it needs is already here. */
  allowanceCents: number
  /** Cumulative allowance: what you were allowed to have spent by the end of this day. */
  theoreticalCents: number
  /** Cumulative real spend, or `null` after today so the line stops instead of
   *  flattening into a wrong "we spent nothing" tail. */
  actualCents: number | null
}

/**
 * Everything the curve is computed from. One object rather than six positional
 * arguments: three of them are arrays of rows and two are ISO strings, so an argument
 * swap would type-check and quietly produce a plausible wrong chart.
 */
export type BurnInput = {
  /** The only pool the curve measures. Passed in, never re-derived here. */
  everydayPoolId: string
  sources: IncomeSource[]
  blocks: PerDiemBlock[]
  expenses: Expense[]
  todayIso: string
}

export type Burn = {
  /**
   * False while the camp has no per-diem source or no datable window — the daily grant
   * is what defines a day's worth of money, so without it the dashboard shows the
   * required-setup callout instead of a chart.
   */
  hasCurve: boolean
  window: CampWindow | null
  points: BurnPoint[]
  /**
   * Cumulative allowance up to today minus everything spent so far. Positive = room left
   * today; negative = already overspent, so today's honest budget is nothing. It shrinks
   * as you spend today, which is what makes it answerable standing in a supermarket.
   */
  allowedTodayCents: number
  spentTodayCents: number
  /** "A normal day here costs €X": today's allowance, or the window's average day when
   *  today falls outside the camp — €0 before the camp starts would say nothing. */
  normalDayCents: number
}

/** The reading for "no camp open". Spelled out once so callers that have to produce a
 *  `Burn` before a camp exists don't invent a fake camp to feed `computeBurn`. */
export const emptyBurn: Burn = {
  hasCurve: false,
  window: null,
  points: [],
  allowedTodayCents: 0,
  spentTodayCents: 0,
  normalDayCents: 0,
}

/** Σ people on blocks covering this day. Advisory only: two blocks covering the same
 *  people on the same days would double-count, which is why the money math below never
 *  reads this number back as a headcount. */
function presentOn(day: string, blocks: PerDiemBlock[]): number {
  return blocks.reduce(
    (sum, b) => (isWithin(day, b.startDate, b.endDate) ? sum + b.numPersons : sum),
    0,
  )
}

/** Σ people × rate on blocks covering this day — the per-head part of the allowance. */
function perDiemAllowanceOn(day: string, blocks: PerDiemBlock[]): number {
  return blocks.reduce(
    (sum, b) =>
      isWithin(day, b.startDate, b.endDate) ? sum + b.numPersons * b.ratePerPersonDayCents : sum,
    0,
  )
}

/**
 * A flat grant spread over the camp, weighted by how many people were there each day.
 *
 * The rounding is the whole point: rounding each day's share on its own loses or invents
 * cents, so the *cumulative* figure is rounded and then differenced. The last day's
 * cumulative is the total by construction, which makes the spread exact.
 *
 * With no person-days at all (funded flat money, nobody entered per-diem blocks yet) the
 * weight falls back to an even split — the same cumulative trick, just a different
 * weight, and no division by zero.
 */
function spreadFlat(totalCents: number, personDaysPerDay: number[]): number[] {
  const totalPersonDays = personDaysPerDay.reduce((sum, n) => sum + n, 0)
  const dayCount = personDaysPerDay.length
  const perDay: number[] = []

  let personDaysSoFar = 0
  let cumulativeSoFar = 0

  for (const [index, personDays] of personDaysPerDay.entries()) {
    personDaysSoFar += personDays
    const weight = totalPersonDays > 0 ? personDaysSoFar / totalPersonDays : (index + 1) / dayCount
    const cumulative = Math.round(totalCents * weight)
    perDay.push(cumulative - cumulativeSoFar)
    cumulativeSoFar = cumulative
  }

  return perDay
}

/** Fixed grants parked in the everyday pool. Per D2 they do not shrink when people
 *  leave — €50 of extra food money is €50 at any headcount — so they enter the curve
 *  whole, only their *timing* is spread. */
function flatTotalCents(sources: IncomeSource[], everydayPoolId: string): number {
  return sources.reduce(
    (sum, s) => (s.kind === 'fixed' && s.poolId === everydayPoolId ? sum + s.amountCents : sum),
    0,
  )
}

function everydayExpenses(expenses: Expense[], everydayPoolId: string): Expense[] {
  return expenses.filter((e) => e.poolId === everydayPoolId)
}

/** Σ everyday-pool spending dated on or before `day`. Receipts dated before the camp
 *  started are included from the first day, so early shopping is not invisible. */
function spentUpTo(day: string, expenses: Expense[]): number {
  return expenses.reduce((sum, e) => (e.date <= day ? sum + e.amountCents : sum), 0)
}

/** One row per calendar day of the camp, both series on it. Empty when the camp has no
 *  window yet. */
export function burnSeries(input: BurnInput): BurnPoint[] {
  const window = campWindow(input.blocks)
  if (window === null) return []

  const days = eachDay(window.startIso, window.endIso)
  const reality = realityBlocks(input.blocks)
  const spending = everydayExpenses(input.expenses, input.everydayPoolId)

  const flatPerDay = spreadFlat(
    flatTotalCents(input.sources, input.everydayPoolId),
    days.map((day) => presentOn(day, reality)),
  )

  let theoreticalCents = 0
  return days.map((day, index) => {
    const allowanceCents = perDiemAllowanceOn(day, reality) + (flatPerDay[index] ?? 0)
    theoreticalCents += allowanceCents

    return {
      date: day,
      dayLabel: String(Number(day.slice(8, 10))),
      allowanceCents,
      theoreticalCents,
      actualCents: day > input.todayIso ? null : spentUpTo(day, spending),
    }
  })
}

/** The whole dashboard reading: the chart's rows plus the three numbers above it. */
export function computeBurn(input: BurnInput): Burn {
  // Without the daily grant there is no "a day's worth of money", so there is no curve —
  // flat money alone would spread itself over a window it never defined.
  const hasPerDiem = input.sources.some((s) => s.kind === 'per_diem')
  const window = campWindow(input.blocks)
  const points = hasPerDiem ? burnSeries(input) : []

  const spending = everydayExpenses(input.expenses, input.everydayPoolId)
  // Days after today have no theoretical figure yet; before the camp starts there is no
  // day at all, and the allowance is honestly zero.
  const accruedCents = points.findLast((p) => p.date <= input.todayIso)?.theoreticalCents ?? 0

  const totalAllowanceCents = points.reduce((sum, p) => sum + p.allowanceCents, 0)
  const todayPoint = points.find((p) => p.date === input.todayIso)
  const averageDayCents = points.length === 0 ? 0 : Math.round(totalAllowanceCents / points.length)

  return {
    hasCurve: points.length > 0,
    window,
    points,
    allowedTodayCents: accruedCents - spentUpTo(input.todayIso, spending),
    spentTodayCents: spending.reduce(
      (sum, e) => (e.date === input.todayIso ? sum + e.amountCents : sum),
      0,
    ),
    normalDayCents: todayPoint?.allowanceCents ?? averageDayCents,
  }
}
