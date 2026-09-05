/**
 * One camp's out-of-pocket expenses as a live query, plus the three writes that change
 * them. Scoped by `campId`, exactly like `useExpenses` — the two namespaces stay apart
 * because this money never touches a pool.
 */

import { useCallback, useMemo } from 'react'
import { db } from '../db/instant'
import * as otherExpensesDb from '../db/otherExpensesDb'
import type { SaveOtherExpenseInput } from '../lib/otherExpenses'
import { mapRows, toOtherExpense } from '../lib/rows'
import type { OtherExpense } from '../lib/types'
import { useWriteState } from './useWriteState'

export type UseOtherExpenses = {
  /** Newest day first. */
  otherExpenses: OtherExpense[]
  isLoading: boolean
  error: string | null
  saveOtherExpense: (input: SaveOtherExpenseInput) => void
  /** Tick a row off as taken over by the money holder, or un-tick it. */
  setReimbursed: (expenseId: string, reimbursed: boolean) => void
  deleteOtherExpense: (expenseId: string) => void
}

/** Pass `''` while no camp is open: the query is skipped rather than run for nothing. */
export function useOtherExpenses(campId: string): UseOtherExpenses {
  const {
    isLoading,
    error: queryError,
    data,
  } = db.useQuery(
    campId === ''
      ? null
      : {
          // Ordering by an indexed attribute lets the server do it; the sorts in
          // `lib/otherExpenses.ts` break the same-day ties identically on both phones.
          otherExpenses: { $: { where: { campId }, order: { date: 'desc' } } },
        },
  )

  const { error, run } = useWriteState(queryError)

  // Memoised on the query result: the report takes this array as a dependency, so a fresh
  // array every render would rebuild all three tables on every keystroke elsewhere.
  const otherExpenses = useMemo(
    () => mapRows<OtherExpense>(data?.otherExpenses, toOtherExpense),
    [data],
  )

  const saveOtherExpense = useCallback(
    (input: SaveOtherExpenseInput): void => run(otherExpensesDb.saveOtherExpense(input)),
    [run],
  )

  const setReimbursed = useCallback(
    (expenseId: string, reimbursed: boolean): void =>
      run(otherExpensesDb.setOtherExpenseReimbursed(expenseId, reimbursed)),
    [run],
  )

  const deleteOtherExpense = useCallback(
    (expenseId: string): void => run(otherExpensesDb.deleteOtherExpense(expenseId)),
    [run],
  )

  return {
    otherExpenses,
    isLoading,
    error,
    saveOtherExpense,
    setReimbursed,
    deleteOtherExpense,
  }
}
