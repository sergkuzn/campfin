/**
 * Writes for one camp's out-of-pocket expenses. Reads live in
 * `src/hooks/useOtherExpenses.ts`.
 *
 * Same shape as `expensesDb.ts` — a row owns nothing, so there is no cascade to plan. Ids
 * and timestamps are minted here, which is what keeps `src/lib/` pure.
 */

import { id } from '@instantdb/react'
import type { SaveOtherExpenseInput } from '../lib/otherExpenses'
import { chunk, db } from './instant'

/**
 * Create or update one row. `update` on an existing id is a merge, so editing a row keeps
 * its `createdAt` and the list's within-a-day order stays stable across an edit.
 */
export function saveOtherExpense(input: SaveOtherExpenseInput): Promise<unknown> {
  const now = Date.now()
  const expenseId = input.existing?.id ?? id()
  const createdAt = input.existing?.createdAt ?? now

  return db.transact(
    chunk(db.tx.otherExpenses[expenseId])
      .update({
        campId: input.campId,
        name: input.name,
        amountCents: input.amountCents,
        date: input.date,
        paidBy: input.paidBy,
        // null clears the attribute: a note the user emptied must actually go away,
        // otherwise the old one survives the save.
        note: input.note ?? null,
        reimbursed: input.reimbursed ?? null,
        createdAt,
      })
      // Permission rules can only traverse links, so the camp link is what makes this row
      // readable by the camp's members at all.
      .link({ camp: input.campId }),
  )
}

/**
 * Tick a row off as taken over by the money holder, or un-tick it. One attribute, written
 * straight from the list — settling up costs a tap, not a trip through the editor.
 *
 * It moves who the organisation owes, never how much: the amount is a claim either way.
 */
export function setOtherExpenseReimbursed(
  expenseId: string,
  reimbursed: boolean,
): Promise<unknown> {
  return db.transact(
    chunk(db.tx.otherExpenses[expenseId]).update({ reimbursed: reimbursed || null }),
  )
}

export function deleteOtherExpense(expenseId: string): Promise<unknown> {
  return db.transact(chunk(db.tx.otherExpenses[expenseId]).delete())
}
