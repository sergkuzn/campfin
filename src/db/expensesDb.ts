/**
 * Writes for one camp's receipts. Reads live in `src/hooks/useExpenses.ts`.
 *
 * Simpler than `incomeDb.ts` on purpose: an expense owns nothing, so no other row has to
 * die with it and there is no cascade to plan. Ids and timestamps are minted here, which
 * is what keeps `src/lib/` pure.
 */

import { id } from '@instantdb/react'
import type { SaveExpenseInput } from '../lib/expenses'
import { chunk, db } from './instant'

/**
 * Create or update one receipt. `update` on an existing id is a merge, so editing a row
 * keeps its `createdAt` — the list's within-a-day order stays stable across an edit.
 */
export function saveExpense(input: SaveExpenseInput): Promise<unknown> {
  const now = Date.now()
  const expenseId = input.existing?.id ?? id()
  const createdAt = input.existing?.createdAt ?? now

  return db.transact(
    chunk(db.tx.expenses[expenseId])
      .update({
        campId: input.campId,
        poolId: input.poolId,
        name: input.name,
        amountCents: input.amountCents,
        date: input.date,
        // null clears the attribute: a note or a number the user emptied must actually go
        // away, otherwise the old one survives the save.
        number: input.number ?? null,
        note: input.note ?? null,
        paidBy: input.paidBy ?? null,
        reimbursed: input.reimbursed ?? null,
        // Cleared the same way: taking the pfand off a receipt has to remove the attribute,
        // or the old deposit would survive the edit and go on skewing the ledger.
        pfandPaidCents: input.pfandPaidCents ?? null,
        pfandReturnedCents: input.pfandReturnedCents ?? null,
        pfandInTotal: input.pfandInTotal ?? null,
        createdAt,
      })
      // Permission rules can only traverse links, so the camp link is what makes this row
      // readable by the camp's members at all.
      .link({ camp: input.campId }),
  )
}

/**
 * Tick a receipt off as paid back, or un-tick it. One attribute, written straight from the
 * list — the whole point is that settling up costs a tap, not a trip through the editor.
 *
 * Nothing else is touched: the receipt already spent the pool's money when it was paid, so
 * repaying the person who fronted it must not move a single cent of budget.
 */
export function setExpenseReimbursed(expenseId: string, reimbursed: boolean): Promise<unknown> {
  return db.transact(chunk(db.tx.expenses[expenseId]).update({ reimbursed: reimbursed || null }))
}

/**
 * Delete a receipt. Its deposit needs no cleanup of its own: the pfand ledger derives
 * every line about a receipt from the receipt, so the balances re-net on the next render
 * with nothing left pointing at a row that is gone.
 */
export function deleteExpense(expenseId: string): Promise<unknown> {
  return db.transact(chunk(db.tx.expenses[expenseId]).delete())
}
