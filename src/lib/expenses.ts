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
import { receiptGroupCents, receiptTotalCents, typedEuros } from './pfand'
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
  /**
   * Whether the pfand block is open. Off is not the same as "both amounts empty": closing
   * the block clears the deposit from the receipt whatever is still typed in the boxes, so
   * a user who opened it by mistake cannot save a pfand they thought they had removed.
   */
  pfand: boolean
  /** True when the amount above is the whole receipt total with the pfand folded inside it, false
   *  when it is the goods alone and the pfand rides beside it. */
  pfandInTotal: boolean
  /** The deposit charged on the receipt, as typed. Empty means none. */
  pfandPaid: string
  /** The deposit refunded on the same receipt, as typed. Empty means none. */
  pfandReturned: string
}

/**
 * The two pfand amounts in cents, or null when either box holds something unreadable.
 * A closed block is a zero block regardless of what is in the boxes — that is what makes
 * removing a pfand a single tap.
 */
export function pfandDraftCents(draft: ExpenseDraft): { paid: number; returned: number } | null {
  if (!draft.pfand) return { paid: 0, returned: 0 }
  const paid = optionalCents(draft.pfandPaid)
  const returned = optionalCents(draft.pfandReturned)
  if (paid === null || returned === null) return null
  return { paid, returned }
}

/** An optional euro box: empty is zero, unreadable or negative is null. */
function optionalCents(typed: string): number | null {
  if (typed.trim() === '') return 0
  return parseEurosToCents(typed)
}

/**
 * What this draft would book against its pool, or null while the amount or the pfand is
 * unreadable. The form shows it live: it is the one number that makes the two ways of
 * typing an amount tell themselves apart.
 */
export function draftGroupCents(draft: ExpenseDraft): number | null {
  const typed = parseEurosToCents(draft.amount)
  const pfand = pfandDraftCents(draft)
  if (typed === null || pfand === null) return null
  return receiptGroupCents(typed, pfand.paid, pfand.returned, draft.pfandInTotal)
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
  pfandPaidCents?: number
  pfandReturnedCents?: number
  pfandInTotal?: boolean
}

/**
 * What is wrong with the draft, as *codes* rather than sentences — `lib/` must not know
 * which language the UI speaks, so the dictionary turns each code into text.
 */
export type ExpenseIssue =
  | 'name'
  | 'amount'
  | 'date'
  | 'pool'
  | 'number'
  | 'numberTaken'
  | 'paidBy'
  | 'pfand'
  | 'pfandOverAmount'

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
    (e.pfandPaidCents === undefined || typeof e.pfandPaidCents === 'number') &&
    (e.pfandReturnedCents === undefined || typeof e.pfandReturnedCents === 'number') &&
    (e.pfandInTotal === undefined || typeof e.pfandInTotal === 'boolean') &&
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
    // Closed: nearly every receipt carries no deposit, and a form that asks about it
    // every time would charge the common case for the rare one.
    pfand: false,
    // The printed total is the number in front of you when you are typing a receipt, so that
    // is what the block opens on.
    pfandInTotal: true,
    pfandPaid: '',
    pfandReturned: '',
  }
}

/** Seed the editor from a persisted row. */
export function draftFromExpense(expense: Expense): ExpenseDraft {
  const paid = expense.pfandPaidCents ?? 0
  const returned = expense.pfandReturnedCents ?? 0
  const inTotal = expense.pfandInTotal === true
  // Put back the number that was actually typed. `amountCents` is stored normalised to the
  // group's money, so a receipt entered as a whole total has to be folded back up — otherwise
  // re-opening it would show a figure the paper slip does not have.
  const shownCents = inTotal ? receiptTotalCents(expense) : expense.amountCents

  return {
    date: expense.date,
    name: expense.name,
    amount: typedEuros(shownCents),
    poolId: expense.poolId,
    number: expense.number === undefined ? '' : String(expense.number),
    note: expense.note ?? '',
    paidBy: expense.paidBy ?? '',
    pfand: paid > 0 || returned > 0,
    pfandInTotal: inTotal,
    pfandPaid: paid === 0 ? '' : typedEuros(paid),
    pfandReturned: returned === 0 ? '' : typedEuros(returned),
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

  const pfand = pfandDraftCents(draft)
  if (pfand === null) issues.push('pfand')
  else if (
    cents !== null &&
    receiptGroupCents(cents, pfand.paid, pfand.returned, draft.pfandInTotal) <= 0
  ) {
    // A receipt total that is all deposit bought no goods, so there is nothing here — what
    // happened was a pfand move, and that belongs on the pfand screen where it can be
    // recorded without spending a pool.
    issues.push('pfandOverAmount')
  }

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

  const typedCents = parseEurosToCents(draft.amount)
  const pfand = pfandDraftCents(draft)
  // Unreachable after the gate; keeps the types honest without a non-null assertion.
  if (typedCents === null || pfand === null) return null

  const number = readReceiptNumber(draft.number)
  const note = draft.note.trim()
  const paidBy = draft.paidBy.trim()
  return {
    existing,
    campId,
    poolId: draft.poolId,
    name: draft.name.trim(),
    // Normalised here, once: what is stored is the money the pool spent, so every sum
    // elsewhere stays a plain sum over receipts and none of them can forget the pfand.
    amountCents: receiptGroupCents(typedCents, pfand.paid, pfand.returned, draft.pfandInTotal),
    date: draft.date,
    number: number.kind === 'value' ? number.value : undefined,
    note: note === '' ? undefined : note, // an omitted optional field is undefined, not ''
    paidBy: paidBy === '' ? undefined : paidBy,
    // Carried from the stored row, never from the draft: whether somebody has been paid
    // back is settled on the list, where the tap also moves their pfand. An editor field
    // could only flip the flag, so editing a receipt would have quietly meant something
    // different from tapping Return on it.
    reimbursed: existing?.reimbursed,
    pfandPaidCents: pfand.paid === 0 ? undefined : pfand.paid,
    pfandReturnedCents: pfand.returned === 0 ? undefined : pfand.returned,
    // Only worth storing on a receipt that has a pfand: without one it says nothing, and
    // an absent flag is what every receipt written so far carries.
    pfandInTotal: (pfand.paid > 0 || pfand.returned > 0) && draft.pfandInTotal ? true : undefined,
  }
}
