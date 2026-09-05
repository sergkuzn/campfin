/**
 * An expense the camp's income does not cover: a leader pays out of their own pocket, and
 * the organisation compensates it after camp. The row guard, the form boundary between the
 * editor and the database, and the one total the report adds.
 *
 * Deliberately thinner than `expenses.ts`. There is no pool to tag, no receipt number to
 * keep unique and no pfand to normalise the amount against — what is stored is exactly what
 * was typed. Pure: no React, no database, no clock; "today" arrives as an argument.
 */

import { parseEurosToCents } from './money'
import type { OtherExpense } from './types'

/** The form's editable shape: everything a string, euros still euros. */
export type OtherExpenseDraft = {
  date: string // ISO "YYYY-MM-DD"
  name: string
  amount: string // euros as typed
  /** Whose own money, as typed. Empty means nothing has been picked yet, which is what the
   *  form starts at and what blocks the save until it is answered. */
  paidBy: string
  note: string
}

/** What the hook needs to write a row. Ids and timestamps are minted in `src/db/`. */
export type SaveOtherExpenseInput = {
  /** The row being edited, or null when adding. Carries id + createdAt forward. */
  existing: OtherExpense | null
  campId: string
  name: string
  amountCents: number
  date: string
  paidBy: string
  note?: string
  reimbursed?: boolean
}

/**
 * What is wrong with the draft, as *codes* rather than sentences — `lib/` must not know
 * which language the UI speaks, so the dictionary turns each code into text.
 */
export type OtherExpenseIssue = 'name' | 'amount' | 'date' | 'paidBy'

/** The door from an unknown database row into the typed world. */
export function isOtherExpense(value: unknown): value is OtherExpense {
  if (typeof value !== 'object' || value === null) return false
  const e = value as Record<string, unknown>
  return (
    typeof e.id === 'string' &&
    typeof e.campId === 'string' &&
    typeof e.name === 'string' &&
    typeof e.amountCents === 'number' &&
    typeof e.date === 'string' &&
    typeof e.paidBy === 'string' &&
    (e.note === undefined || typeof e.note === 'string') &&
    (e.reimbursed === undefined || typeof e.reimbursed === 'boolean') &&
    typeof e.createdAt === 'number'
  )
}

/** A fresh draft, dated today — these are typed on the day the money left, like a receipt. */
export function blankOtherExpenseDraft(todayIso: string): OtherExpenseDraft {
  // `paidBy` starts empty on purpose: whose money it was is the whole point of the row, so
  // it is a decision the user makes rather than a default they can save without noticing.
  return { date: todayIso, name: '', amount: '', paidBy: '', note: '' }
}

/** Seed the editor from a persisted row. */
export function draftFromOtherExpense(expense: OtherExpense): OtherExpenseDraft {
  return {
    date: expense.date,
    name: expense.name,
    // Not formatEuros: its "8,00 €" has a currency sign the parser rejects on re-save.
    amount: (expense.amountCents / 100).toFixed(2).replace('.', ','),
    paidBy: expense.paidBy,
    note: expense.note ?? '',
  }
}

/** Problems with the draft. Empty array = Save is allowed. */
export function otherExpenseIssues(draft: OtherExpenseDraft): OtherExpenseIssue[] {
  const issues: OtherExpenseIssue[] = []

  if (draft.name.trim() === '') issues.push('name')

  // The parser refuses a minus sign, so "−5,00" arrives here as null: a negative expense
  // would quietly *reduce* what the organisation owes rather than correcting a row.
  const cents = parseEurosToCents(draft.amount)
  if (cents === null || cents <= 0) issues.push('amount')

  if (draft.date === '') issues.push('date')
  // One blank covers both ways of not answering: no option picked, and "someone else"
  // picked with no name typed. Neither says whose money the organisation owes back.
  if (draft.paidBy.trim() === '') issues.push('paidBy')

  return issues
}

/** The draft as a write payload, or null while `otherExpenseIssues` is non-empty. */
export function otherExpenseDraftToInput(
  draft: OtherExpenseDraft,
  campId: string,
  existing: OtherExpense | null,
): SaveOtherExpenseInput | null {
  // One gate, so a caller cannot smuggle an invalid draft past validation by calling this
  // instead of checking the issues first.
  if (otherExpenseIssues(draft).length > 0) return null

  const amountCents = parseEurosToCents(draft.amount)
  if (amountCents === null) return null // unreachable after the gate; keeps the type honest

  const note = draft.note.trim()
  return {
    existing,
    campId,
    name: draft.name.trim(),
    amountCents,
    date: draft.date,
    paidBy: draft.paidBy.trim(),
    note: note === '' ? undefined : note, // an omitted optional field is undefined, not ''
    // Carried from the stored row, never from the draft: whether the holder has taken the
    // claim over is settled on the list, exactly as it is for a receipt.
    reimbursed: existing?.reimbursed,
  }
}

/** Everything paid out of pocket, whoever paid it. */
export function otherExpensesTotalCents(expenses: OtherExpense[]): number {
  return expenses.reduce((total, expense) => total + expense.amountCents, 0)
}

/**
 * Oldest first — the order a ledger is read in, and the order the report lists them. Ties
 * within a day fall back to `createdAt`, so both phones sort an identical list.
 */
export function sortOtherExpensesOldestFirst(expenses: OtherExpense[]): OtherExpense[] {
  return expenses.toSorted((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
}

/** Newest first, for the screen: the row you just typed is the one you want to see. */
export function sortOtherExpensesNewestFirst(expenses: OtherExpense[]): OtherExpense[] {
  return expenses.toSorted((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
}
