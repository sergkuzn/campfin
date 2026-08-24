/**
 * A receipt as pure data: the row guard and the form boundary between the editor and the
 * database. No React, no database, no clock — "today" arrives as an argument. How the list
 * is grouped and sorted lives in `expenseViews.ts`, the number itself in
 * `receiptNumbers.ts`.
 *
 * An expense is the only thing that *consumes* budget. Cash that merely changes hands (a
 * Kaution, a participation fee) is a `Movement` and lives elsewhere, which is what keeps
 * pool arithmetic a plain sum over expenses.
 */

import { parseEurosToCents } from './money'
import { isReceiptNumber, readReceiptNumber } from './receiptNumbers'
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
