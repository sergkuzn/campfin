/**
 * Receipts (receipts) as pure data: the row guard, the form boundary, and the grouping
 * the list screen renders. No React, no database, no clock — "today" arrives as an
 * argument.
 *
 * An expense is the only thing that *consumes* budget. Cash that merely changes hands (a
 * Kaution, a volunteer's money) is a `Movement` and lives elsewhere, which is what keeps
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
  note: string
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
  note?: string
}

/**
 * What is wrong with the draft, as *codes* rather than sentences — `lib/` must not know
 * which language the UI speaks, so the dictionary turns each code into text.
 */
export type ExpenseIssue = 'name' | 'amount' | 'date' | 'pool'

/** One day of receipts, newest first inside it, with the day's total. */
export type ExpenseDay = {
  date: string
  expenses: Expense[]
  totalCents: number
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
    (e.note === undefined || typeof e.note === 'string') &&
    (e.enteredBy === undefined || typeof e.enteredBy === 'string') &&
    typeof e.createdAt === 'number'
  )
}

/**
 * A fresh draft. Today's date is passed in, not read: a receipt is nearly always entered
 * on the day it was paid, and the clock stays at the edge so this is testable.
 */
export function blankExpenseDraft(todayIso: string, poolId: string): ExpenseDraft {
  return { date: todayIso, name: '', amount: '', poolId, note: '' }
}

/** Seed the editor from a persisted row. */
export function draftFromExpense(expense: Expense): ExpenseDraft {
  return {
    date: expense.date,
    name: expense.name,
    // Not formatEuros: its "8,00 €" has a currency sign the parser rejects on re-save.
    amount: (expense.amountCents / 100).toFixed(2).replace('.', ','),
    poolId: expense.poolId,
    note: expense.note ?? '',
  }
}

/** Problems with the draft. Empty array = Save is allowed. */
export function expenseIssues(draft: ExpenseDraft): ExpenseIssue[] {
  const issues: ExpenseIssue[] = []

  if (draft.name.trim() === '') issues.push('name')

  // The parser refuses a minus sign, so "−5,00" arrives here as null: a receipt for a
  // negative amount would quietly *increase* a pool's leftover.
  const cents = parseEurosToCents(draft.amount)
  if (cents === null || cents <= 0) issues.push('amount')

  if (draft.date === '') issues.push('date')
  if (draft.poolId === '') issues.push('pool')

  return issues
}

/** The draft as a write payload, or null while `expenseIssues` is non-empty. */
export function expenseDraftToInput(
  draft: ExpenseDraft,
  campId: string,
  existing: Expense | null,
): SaveExpenseInput | null {
  // One gate, so a caller cannot smuggle an invalid draft past validation by calling
  // this instead of checking the issues first.
  if (expenseIssues(draft).length > 0) return null

  const amountCents = parseEurosToCents(draft.amount)
  if (amountCents === null) return null // unreachable after the gate; keeps the type honest

  const note = draft.note.trim()
  return {
    existing,
    campId,
    poolId: draft.poolId,
    name: draft.name.trim(),
    amountCents,
    date: draft.date,
    note: note === '' ? undefined : note, // an omitted optional field is undefined, not ''
  }
}

/**
 * The list as the screen wants it: newest day first, newest row first inside a day, with
 * each day's total. ISO dates sort correctly as plain strings, so no Date object is
 * needed. The id breaks a `createdAt` tie, so two rows written in the same millisecond on
 * two phones land in the same order on both.
 */
export function groupExpensesByDay(expenses: Expense[]): ExpenseDay[] {
  // A Map keeps insertion order, so filling it from date-sorted rows gives the days back
  // already sorted — no second sort over the groups.
  const byDay = new Map<string, Expense[]>()

  const sorted = expenses.toSorted(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt || a.id.localeCompare(b.id),
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
