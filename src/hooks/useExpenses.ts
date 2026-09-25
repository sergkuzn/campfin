/**
 * One camp's receipts as a live query, plus the two writes that change them. Scoped by
 * `campId`, so a screen renders exactly the rows it asked for.
 *
 * Rows arrive in no particular order (a database is a set, not a list). The ordering here
 * is the newest-first one both the list screen and the day grouping want.
 */

import { useCallback, useMemo } from 'react'
import * as expensesDb from '../db/expensesDb'
import { db, viewOptions } from '../db/instant'
import type { SaveExpenseInput } from '../lib/expenses'
import { mapRows, toExpense } from '../lib/rows'
import type { Expense } from '../lib/types'
import { useWriteState } from './useWriteState'

export type UseExpenses = {
  /** Newest day first; inside a day, newest row first. */
  expenses: Expense[]
  isLoading: boolean
  error: string | null
  saveExpense: (input: SaveExpenseInput) => void
  /**
   * Tick a receipt off as paid back, or un-tick it. This also moves the receipt's deposit:
   * settling up covers it, so the pfand ledger reads the flag rather than storing a
   * transfer of its own.
   */
  setReimbursed: (expenseId: string, reimbursed: boolean) => void
  deleteExpense: (expenseId: string) => void
}

/**
 * Pass `''` while no camp is open: the query is skipped rather than run for nothing.
 * `viewCode` is set only by the participant view, which reads through its link's code.
 */
export function useExpenses(campId: string, viewCode?: string): UseExpenses {
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
    viewOptions(viewCode),
  )

  const { error, run } = useWriteState(queryError)

  // Memoised on the query result: `summarisePools` downstream takes this array as a
  // dependency, so a fresh array on every render would recompute every pool total.
  const expenses = useMemo(() => mapRows<Expense>(data?.expenses, toExpense), [data])

  const saveExpense = useCallback(
    (input: SaveExpenseInput): void => run(expensesDb.saveExpense(input)),
    [run],
  )

  const setReimbursed = useCallback(
    (expenseId: string, reimbursed: boolean): void =>
      run(expensesDb.setExpenseReimbursed(expenseId, reimbursed)),
    [run],
  )

  const deleteExpense = useCallback(
    (expenseId: string): void => run(expensesDb.deleteExpense(expenseId)),
    [run],
  )

  return {
    expenses,
    isLoading,
    error,
    saveExpense,
    setReimbursed,
    deleteExpense,
  }
}
