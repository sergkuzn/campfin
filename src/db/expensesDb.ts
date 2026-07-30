/**
 * Writes for one camp's quittungs. Reads live in `src/hooks/useExpenses.ts`.
 *
 * Simpler than `incomeDb.ts` on purpose: an expense owns nothing, so no other row has to
 * die with it and there is no cascade to plan. Ids and timestamps are minted here, which
 * is what keeps `src/lib/` pure.
 */

import { id } from '@instantdb/react'
import type { SaveExpenseInput } from '../lib/expenses'
import { chunk, db } from './instant'

/**
 * Create or update one quittung. `update` on an existing id is a merge, so editing a row
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
        // null clears the attribute: a note the user emptied must actually go away,
        // otherwise the old one survives the save.
        note: input.note ?? null,
        createdAt,
      })
      // Permission rules can only traverse links, so the camp link is what makes this row
      // readable by the camp's members at all.
      .link({ camp: input.campId }),
  )
}

export function deleteExpense(expenseId: string): Promise<unknown> {
  return db.transact(chunk(db.tx.expenses[expenseId]).delete())
}
