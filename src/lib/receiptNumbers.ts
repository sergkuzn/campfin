/**
 * The receipt number: the figure written on the paper slip, kept as a plain counting
 * number so a row in the app and a slip in the folder can be matched by eye.
 *
 * Its own module because it is a small vocabulary used from three directions — the form
 * that types one, the list that sorts by one, and the row guard that has to recognise one.
 */

import type { Expense } from './types'

/**
 * A typed receipt number: absent, a usable value, or nonsense. Three outcomes rather than
 * `number | null`, because "the field is empty" is a perfectly good save and "abc" is not,
 * and one null could not tell those apart.
 */
export type NumberField = { kind: 'empty' } | { kind: 'value'; value: number } | { kind: 'invalid' }

/** A receipt number is a counting number: 1, 2, 3 — never 0, a fraction or a negative. */
export function isReceiptNumber(value: unknown): boolean {
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
