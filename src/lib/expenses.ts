/**
 * Receipts (receipts) as pure data: the row guard, the form boundary, and the grouping
 * the list screen renders. No React, no database, no clock — "today" arrives as an
 * argument.
 *
 * An expense is the only thing that *consumes* budget. Cash that merely changes hands (a
 * Kaution, a participation fee) is a `Movement` and lives elsewhere, which is what keeps
 * pool arithmetic a plain sum over expenses.
 */

import { parseEurosToCents } from './money'
import type { Expense } from './types'

/** The form's editable shape: everything a string, euros still euros. */
export type ExpenseDraft = {
  date: string // ISO "YYYY-MM-DD"
  name: string
  amount: string // euros as typed
  poolId: string
  /** The receipt number as typed. Empty means "not filed yet", which is allowed. */
  number: string
  note: string
  /** Whose wallet it came out of, as typed. Empty means nothing has been picked yet, which
   *  is what the form starts at and what blocks the save until it is answered. */
  paidBy: string
  /** Whether that person has already been paid back. Only meaningful when somebody other
   *  than the money holder paid; the form hides it otherwise. */
  reimbursed: boolean
}

/** What the hook needs to write a row. Ids and timestamps are minted in `src/db/`. */
export type SaveExpenseInput = {
  /** The row being edited, or null when adding. Carries id + createdAt forward. */
  existing: Expense | null
  campId: string
  poolId: string
  name: string
  amountCents: number
  date: string
  number?: number
  note?: string
  paidBy?: string
  reimbursed?: boolean
}

/**
 * What is wrong with the draft, as *codes* rather than sentences — `lib/` must not know
 * which language the UI speaks, so the dictionary turns each code into text.
 */
export type ExpenseIssue = 'name' | 'amount' | 'date' | 'pool' | 'number' | 'numberTaken' | 'paidBy'

/**
 * How the list is ordered. Date order groups by day and totals each day; number order is
 * one flat run, because a day heading over a numeric sequence would chop it into pieces.
 */
export type ExpenseSort = 'date_desc' | 'date_asc' | 'number_asc' | 'number_desc'

/**
 * The list as the screen must render it. A discriminated union rather than two nullable
 * fields: checking `view.mode` narrows the type, so the component cannot forget one of the
 * two shapes or reach for days that aren't there.
 */
export type ExpenseView =
  | { mode: 'days'; days: ExpenseDay[] }
  | { mode: 'flat'; expenses: Expense[] }

/**
 * A typed receipt number: absent, a usable value, or nonsense. Three outcomes rather than
 * `number | null`, because "the field is empty" is a perfectly good save and "abc" is not,
 * and one null could not tell those apart.
 */
export type NumberField = { kind: 'empty' } | { kind: 'value'; value: number } | { kind: 'invalid' }

/** One day of receipts, newest first inside it, with the day's total. */
export type ExpenseDay = {
  date: string
  expenses: Expense[]
  totalCents: number
}

/** A receipt number is a counting number: 1, 2, 3 — never 0, a fraction or a negative. */
function isReceiptNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

/**
 * The number field as typed. Only digits are accepted — a stray "12a" is refused rather
 * than silently filed as 12, because the number's whole job is to match a paper slip.
 */
export function readReceiptNumber(text: string): NumberField {
  const trimmed = text.trim()
  if (trimmed === '') return { kind: 'empty' }
  if (!/^\d+$/.test(trimmed)) return { kind: 'invalid' }
  const value = Number(trimmed)
  return isReceiptNumber(value) ? { kind: 'value', value } : { kind: 'invalid' }
}

/**
 * The numbers already in use, so the form can refuse a duplicate. `exceptId` is the row
 * being edited: re-saving receipt #7 without touching its number must not collide with
 * itself.
 */
export function takenReceiptNumbers(
  expenses: Expense[],
  exceptId: string | null,
): ReadonlySet<number> {
  const taken = new Set<number>()
  for (const expense of expenses) {
    if (expense.number !== undefined && expense.id !== exceptId) taken.add(expense.number)
  }
  return taken
}

/** The number the ＋ button offers: one past the highest in use, or 1 in an empty camp. */
export function nextReceiptNumber(expenses: Expense[]): number {
  let highest = 0
  for (const expense of expenses) {
    if (expense.number !== undefined && expense.number > highest) highest = expense.number
  }
  return highest + 1
}

/** The door from an unknown database row into the typed world. */
export function isExpense(value: unknown): value is Expense {
  if (typeof value !== 'object' || value === null) return false
  const e = value as Record<string, unknown>
  return (
    typeof e.id === 'string' &&
    typeof e.campId === 'string' &&
    typeof e.poolId === 'string' &&
    typeof e.name === 'string' &&
    typeof e.amountCents === 'number' &&
    typeof e.date === 'string' &&
    (e.number === undefined || isReceiptNumber(e.number)) &&
    (e.note === undefined || typeof e.note === 'string') &&
    (e.paidBy === undefined || typeof e.paidBy === 'string') &&
    (e.reimbursed === undefined || typeof e.reimbursed === 'boolean') &&
    (e.enteredBy === undefined || typeof e.enteredBy === 'string') &&
    typeof e.createdAt === 'number'
  )
}

/**
 * A fresh draft. Today's date is passed in, not read: a receipt is nearly always entered
 * on the day it was paid, and the clock stays at the edge so this is testable.
 */
export function blankExpenseDraft(
  todayIso: string,
  poolId: string,
  suggestedNumber: number,
): ExpenseDraft {
  // `paidBy` starts empty on purpose: nothing is pre-picked, so recording whose money it
  // was is a decision the user makes rather than a default they can save without noticing.
  // The number is the opposite case: receipts are filed in order, so the next free one is
  // right almost every time and is filled in ready to be overwritten or cleared.
  return {
    date: todayIso,
    name: '',
    amount: '',
    poolId,
    number: String(suggestedNumber),
    note: '',
    paidBy: '',
    reimbursed: false,
  }
}

/** Seed the editor from a persisted row. */
export function draftFromExpense(expense: Expense): ExpenseDraft {
  return {
    date: expense.date,
    name: expense.name,
    // Not formatEuros: its "8,00 €" has a currency sign the parser rejects on re-save.
    amount: (expense.amountCents / 100).toFixed(2).replace('.', ','),
    poolId: expense.poolId,
    number: expense.number === undefined ? '' : String(expense.number),
    note: expense.note ?? '',
    paidBy: expense.paidBy ?? '',
    reimbursed: expense.reimbursed === true,
  }
}

/**
 * Problems with the draft. Empty array = Save is allowed.
 *
 * `taken` is the numbers other receipts in this camp already carry — required rather than
 * defaulted, so a caller cannot skip the uniqueness check by forgetting an argument.
 */
export function expenseIssues(draft: ExpenseDraft, taken: ReadonlySet<number>): ExpenseIssue[] {
  const issues: ExpenseIssue[] = []

  if (draft.name.trim() === '') issues.push('name')

  // The parser refuses a minus sign, so "−5,00" arrives here as null: a receipt for a
  // negative amount would quietly *increase* a pool's leftover.
  const cents = parseEurosToCents(draft.amount)
  if (cents === null || cents <= 0) issues.push('amount')

  if (draft.date === '') issues.push('date')
  if (draft.poolId === '') issues.push('pool')
  // One blank covers both ways of not answering: no option picked, and "someone else"
  // picked with no name typed. Neither is a receipt that says whose money it was.
  if (draft.paidBy.trim() === '') issues.push('paidBy')

  const number = readReceiptNumber(draft.number)
  if (number.kind === 'invalid') issues.push('number')
  // Two receipts filed under one number is exactly the thing the number exists to prevent,
  // so it blocks the save rather than warning about it.
  if (number.kind === 'value' && taken.has(number.value)) issues.push('numberTaken')

  return issues
}

/** The draft as a write payload, or null while `expenseIssues` is non-empty. */
export function expenseDraftToInput(
  draft: ExpenseDraft,
  campId: string,
  existing: Expense | null,
  taken: ReadonlySet<number>,
): SaveExpenseInput | null {
  // One gate, so a caller cannot smuggle an invalid draft past validation by calling
  // this instead of checking the issues first.
  if (expenseIssues(draft, taken).length > 0) return null

  const amountCents = parseEurosToCents(draft.amount)
  if (amountCents === null) return null // unreachable after the gate; keeps the type honest

  const number = readReceiptNumber(draft.number)
  const note = draft.note.trim()
  const paidBy = draft.paidBy.trim()
  return {
    existing,
    campId,
    poolId: draft.poolId,
    name: draft.name.trim(),
    amountCents,
    date: draft.date,
    number: number.kind === 'value' ? number.value : undefined,
    note: note === '' ? undefined : note, // an omitted optional field is undefined, not ''
    paidBy: paidBy === '' ? undefined : paidBy,
    reimbursed: draft.reimbursed || undefined,
  }
}

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
