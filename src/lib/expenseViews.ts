/**
 * The receipts list as the screen renders it: grouped, filtered and sorted. Reading only —
 * nothing here edits a receipt, which is what keeps it separate from the draft lifecycle
 * in `expenses.ts`.
 */

import type { Expense } from './types'

/**
 * How the list is ordered. Date order groups by day and totals each day; number order is
 * one flat run, because a day heading over a numeric sequence would chop it into pieces.
 */
export type ExpenseSort = 'date_desc' | 'date_asc' | 'number_asc' | 'number_desc'

/** One day of receipts, newest first inside it, with the day's total. */
export type ExpenseDay = {
  date: string
  expenses: Expense[]
  totalCents: number
}

/**
 * The list as the screen must render it. A discriminated union rather than two nullable
 * fields: checking `view.mode` narrows the type, so the component cannot forget one of the
 * two shapes or reach for days that aren't there.
 */
export type ExpenseView =
  | { mode: 'days'; days: ExpenseDay[] }
  | { mode: 'flat'; expenses: Expense[] }

/**
 * The list as the screen wants it: by default newest day first and newest row first inside
 * a day, with each day's total. ISO dates sort correctly as plain strings, so no Date
 * object is needed. The id breaks a `createdAt` tie, so two rows written in the same
 * millisecond on two phones land in the same order on both.
 */
export function groupExpensesByDay(
  expenses: Expense[],
  direction: 'desc' | 'asc' = 'desc',
): ExpenseDay[] {
  // A Map keeps insertion order, so filling it from date-sorted rows gives the days back
  // already sorted — no second sort over the groups.
  const byDay = new Map<string, Expense[]>()
  // One factor flips every comparison at once, so ascending order cannot end up with the
  // days one way round and the rows inside them the other.
  const sign = direction === 'desc' ? 1 : -1

  const sorted = expenses.toSorted(
    (a, b) =>
      sign * b.date.localeCompare(a.date) ||
      sign * (b.createdAt - a.createdAt) ||
      a.id.localeCompare(b.id),
  )

  for (const expense of sorted) {
    const day = byDay.get(expense.date)
    if (day === undefined) byDay.set(expense.date, [expense])
    else day.push(expense)
  }

  return [...byDay].map(([date, rows]) => ({
    date,
    expenses: rows,
    totalCents: rows.reduce((sum, e) => sum + e.amountCents, 0),
  }))
}

/**
 * Only the receipts paid from the chosen pools. An empty selection means *no filter*:
 * "nothing ticked" and "everything ticked" are the same view, which is what makes the
 * chips safe to tap off one by one.
 */
export function filterExpensesByPools(
  expenses: Expense[],
  poolIds: ReadonlySet<string>,
): Expense[] {
  if (poolIds.size === 0) return expenses
  return expenses.filter((expense) => poolIds.has(expense.poolId))
}

/**
 * Numbered receipts in numeric order, with the unnumbered ones stacked past the highest
 * number. A receipt with no number is the one that has not been filed yet, so it belongs
 * where the next number would go — which puts it at the end going up and at the top going
 * down, always beside the big numbers rather than among the small ones. Rows sharing a
 * position keep the newest-first order the date view uses.
 */
function sortExpensesByNumber(expenses: Expense[], direction: 'asc' | 'desc'): Expense[] {
  const sign = direction === 'asc' ? 1 : -1
  // Infinity, not a separate "is it numbered" branch: an unfiled receipt sorts as a number
  // above every real one, so reversing the direction carries it along with the sequence.
  const rank = (expense: Expense): number => expense.number ?? Number.POSITIVE_INFINITY

  return expenses.toSorted((a, b) => {
    const aRank = rank(a)
    const bRank = rank(b)
    // Equal ranks are compared first because Infinity - Infinity is NaN, and a NaN
    // comparator leaves the order undefined.
    if (aRank !== bRank) return sign * (aRank - bRank)
    return b.date.localeCompare(a.date) || b.createdAt - a.createdAt || a.id.localeCompare(b.id)
  })
}

/** The rows arranged for one sort setting — grouped by day, or flat by number. */
export function arrangeExpenses(expenses: Expense[], sort: ExpenseSort): ExpenseView {
  switch (sort) {
    case 'date_desc':
      return { mode: 'days', days: groupExpensesByDay(expenses, 'desc') }
    case 'date_asc':
      return { mode: 'days', days: groupExpensesByDay(expenses, 'asc') }
    case 'number_asc':
      return { mode: 'flat', expenses: sortExpensesByNumber(expenses, 'asc') }
    case 'number_desc':
      return { mode: 'flat', expenses: sortExpensesByNumber(expenses, 'desc') }
    default: {
      // Exhaustiveness guard: a fifth sort mode breaks the build here rather than
      // silently rendering the rows in query order.
      const _never: never = sort
      return _never
    }
  }
}
