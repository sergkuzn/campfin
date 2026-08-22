/**
 * Who fronted the cash for a receipt, and what the money holder still owes them.
 *
 * A payer is a **name typed on the receipt**, not a row in a namespace of its own. That
 * choice costs a rename — correcting a misspelling means editing the receipts that carry
 * it — and buys everything else: no extra table, no permission rule, no id to remap on
 * import, and a name that survives a dump being hand-edited.
 *
 * What it would also have cost is a person split in two by a stray capital, and that is
 * what `payerKey` is for: **stored as typed, compared normalised**. Every question this
 * module asks — is this the holder, are these the same person, who is in the list — goes
 * through the key, while the screen keeps showing whatever was actually typed.
 *
 * Debt is derived, never stored. Only the repayment is a fact worth writing down.
 */

import type { Expense } from './types'

/** One payer's outstanding total. Always positive — settled people are not listed. */
export type PayerDebt = {
  /** As typed, for display: the spelling the newest receipt used. */
  name: string
  owedCents: number
  receiptCount: number
}

/** How many receipts change sides when the holder does. */
export type HolderChange = {
  /** Receipts that owe money today and would stop, because the new holder paid them. */
  stopOwing: number
  /** Receipts that are settled today and would start owing, because the old holder paid. */
  startOwing: number
}

/**
 * The key two spellings of one person share: trimmed, inner runs of whitespace collapsed,
 * lower-cased. "Ben", "ben" and " Ben  Ohm " are one person; "Bne" is not, and never can
 * be — that one is fixed by editing the receipt.
 */
export function payerKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** True once a name is worth storing — a field left blank is an absent payer, not a payer
 *  called "". */
function isNamed(name: string | undefined): name is string {
  return name !== undefined && payerKey(name) !== ''
}

/** True when both names mean the same person, either of them possibly absent. */
export function isSamePayer(a: string | undefined, b: string | undefined): boolean {
  if (!isNamed(a) || !isNamed(b)) return false
  return payerKey(a) === payerKey(b)
}

/**
 * Who this receipt still owes money to, or null if nobody does. Returning the *name*
 * rather than a boolean is what lets the totals below group by person without re-checking
 * that the field is set — and it keeps the narrowing in one place instead of forcing every
 * caller to prove `paidBy` is there.
 *
 * With no holder named the whole idea is dormant — there is no one for the debt to be
 * owed *by*, so nothing is owed.
 */
export function owedPayerName(expense: Expense, moneyHolder: string | undefined): string | null {
  if (expense.reimbursedAt !== undefined) return null
  if (!isNamed(moneyHolder) || !isNamed(expense.paidBy)) return null
  if (payerKey(expense.paidBy) === payerKey(moneyHolder)) return null
  return expense.paidBy.trim()
}

/** Money the holder has not paid back yet: someone else fronted it, and nobody has ticked
 *  it off. */
export function owesPayer(expense: Expense, moneyHolder: string | undefined): boolean {
  return owedPayerName(expense, moneyHolder) !== null
}

/**
 * The names the "Paid by" picker offers: the holder first — most receipts are theirs — then
 * everyone the camp's receipts already name, alphabetically.
 *
 * Where two spellings of one person exist, the newest receipt's wins: the list should offer
 * the way you last wrote it, not the way you wrote it in July. The holder is the exception,
 * and keeps the spelling stored on the camp.
 */
export function knownPayers(expenses: Expense[], moneyHolder: string | undefined): string[] {
  // Keyed by the normalised name, so a stray capital adds a spelling rather than a person.
  const newest = new Map<string, { name: string; createdAt: number }>()

  for (const expense of expenses) {
    if (!isNamed(expense.paidBy)) continue
    const key = payerKey(expense.paidBy)
    const seen = newest.get(key)
    if (seen === undefined || expense.createdAt > seen.createdAt) {
      newest.set(key, { name: expense.paidBy.trim(), createdAt: expense.createdAt })
    }
  }

  const holderKey = isNamed(moneyHolder) ? payerKey(moneyHolder) : null
  if (holderKey !== null) newest.delete(holderKey)

  const others = [...newest.values()].map((entry) => entry.name).sort((a, b) => a.localeCompare(b))

  return isNamed(moneyHolder) ? [moneyHolder.trim(), ...others] : others
}

/**
 * What the holder owes each person, largest debt first — that is the order you settle up
 * in. People who are square do not appear.
 */
export function payerDebts(expenses: Expense[], moneyHolder: string | undefined): PayerDebt[] {
  const byKey = new Map<string, PayerDebt & { newestAt: number }>()

  for (const expense of expenses) {
    const name = owedPayerName(expense, moneyHolder)
    if (name === null) continue
    const key = payerKey(name)
    const debt = byKey.get(key)

    if (debt === undefined) {
      const seed = { name, owedCents: expense.amountCents, receiptCount: 1 }
      byKey.set(key, { ...seed, newestAt: expense.createdAt })
      continue
    }

    debt.owedCents += expense.amountCents
    debt.receiptCount += 1
    // Same rule as the picker: the newest receipt decides how the name is spelled.
    if (expense.createdAt > debt.newestAt) {
      debt.name = name
      debt.newestAt = expense.createdAt
    }
  }

  return [...byKey.values()]
    .map(({ name, owedCents, receiptCount }) => ({ name, owedCents, receiptCount }))
    .sort((a, b) => b.owedCents - a.owedCents || a.name.localeCompare(b.name))
}

/** Everything the holder still owes, across everyone. */
export function unreimbursedTotalCents(
  expenses: Expense[],
  moneyHolder: string | undefined,
): number {
  return expenses.reduce(
    (sum, expense) => (owesPayer(expense, moneyHolder) ? sum + expense.amountCents : sum),
    0,
  )
}

/** Only the receipts still owed. `false` means no filter, so the caller need not branch. */
export function filterExpensesByDebt(
  expenses: Expense[],
  unpaidOnly: boolean,
  moneyHolder: string | undefined,
): Expense[] {
  if (!unpaidOnly) return expenses
  return expenses.filter((expense) => owesPayer(expense, moneyHolder))
}

/**
 * What handing the wallet to someone else would do to the list, so the confirm can say it
 * in numbers rather than in the abstract.
 *
 * Debt is derived, which is exactly why this is worth showing: changing the holder rewrites
 * no rows but flips who owes whom, in both directions at once. Pass `null` for `next` to
 * count what clearing the holder would do.
 */
export function holderChangeImpact(
  expenses: Expense[],
  current: string | undefined,
  next: string | null,
): HolderChange {
  const after = next === null ? undefined : next
  let stopOwing = 0
  let startOwing = 0

  for (const expense of expenses) {
    const owedBefore = owesPayer(expense, current)
    const owedAfter = owesPayer(expense, after)
    if (owedBefore && !owedAfter) stopOwing += 1
    if (!owedBefore && owedAfter) startOwing += 1
  }

  return { stopOwing, startOwing }
}
