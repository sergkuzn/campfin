/**
 * One camp's receipts as a live query, plus the two writes that change them. Scoped by
 * `campId`, so a screen renders exactly the rows it asked for.
 *
 * Rows arrive in no particular order (a database is a set, not a list). The ordering here
 * is the newest-first one both the list screen and the day grouping want.
 */

import { useCallback, useMemo, useState } from 'react'
import * as expensesDb from '../db/expensesDb'
import { db } from '../db/instant'
import { useT } from '../i18n'
import type { SaveExpenseInput } from '../lib/expenses'
import { mapRows, toExpense } from '../lib/rows'
import type { Expense } from '../lib/types'

export type UseExpenses = {
  /** Newest day first; inside a day, newest row first. */
  expenses: Expense[]
  isLoading: boolean
  error: string | null
  saveExpense: (input: SaveExpenseInput) => void
  deleteExpense: (expenseId: string) => void
}

/** Pass `''` while no camp is open: the query is skipped rather than run for nothing. */
export function useExpenses(campId: string): UseExpenses {
  const t = useT()
  const [error, setError] = useState<string | null>(null)

  const {
    isLoading,
    error: queryError,
    data,
  } = db.useQuery(
    campId === ''
      ? null
      : {
          // Ordering by an indexed attribute lets the server do it; `createdAt` and the id
          // break same-day ties, which the pure grouping in `lib/expenses.ts` handles.
          expenses: { $: { where: { campId }, order: { date: 'desc' } } },
        },
  )

  // Memoised on the query result: `summarisePools` downstream takes this array as a
  // dependency, so a fresh array on every render would recompute every pool total.
  const expenses = useMemo(() => mapRows<Expense>(data?.expenses, toExpense), [data])

  const saveExpense = useCallback(
    (input: SaveExpenseInput): void => {
      setError(null)
      void expensesDb.saveExpense(input).catch(() => setError(t.sync.writeFailed))
    },
    [t],
  )

  const deleteExpense = useCallback(
    (expenseId: string): void => {
      setError(null)
      void expensesDb.deleteExpense(expenseId).catch(() => setError(t.sync.writeFailed))
    },
    [t],
  )

  return {
    expenses,
    isLoading,
    error: queryError === undefined ? error : t.sync.loadFailed(queryError.message),
    saveExpense,
    deleteExpense,
  }
}
