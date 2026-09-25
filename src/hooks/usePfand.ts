/**
 * One camp's pfand entries as a live query, plus the two writes that change them.
 * Scoped by `campId`, exactly like `useExpenses` — the receipts half of the ledger comes
 * from that hook, and `pfandLedger` is where the two are put together.
 */

import { useCallback, useMemo } from 'react'
import { db, viewOptions } from '../db/instant'
import * as pfandDb from '../db/pfandDb'
import type { SavePfandInput } from '../lib/pfand'
import { mapRows, toPfandEntry } from '../lib/rows'
import type { PfandEntry } from '../lib/types'
import { useWriteState } from './useWriteState'

export type UsePfand = {
  /** Newest first. */
  entries: PfandEntry[]
  isLoading: boolean
  error: string | null
  saveEntry: (input: SavePfandInput) => void
  deleteEntry: (entryId: string) => void
}

/**
 * Pass `''` while no camp is open: the query is skipped rather than run for nothing.
 * `viewCode` is set only by the participant view, which reads through its link's code.
 */
export function usePfand(campId: string, viewCode?: string): UsePfand {
  const {
    isLoading,
    error: queryError,
    data,
  } = db.useQuery(
    campId === ''
      ? null
      : {
          // Ordering by an indexed attribute lets the server do it; `sortPfandTxns`
          // downstream breaks the same-day ties identically on both phones.
          pfandEntries: { $: { where: { campId }, order: { date: 'desc' } } },
        },
    viewOptions(viewCode),
  )

  const { error, run } = useWriteState(queryError)

  // Memoised on the query result: the ledger and the balances take this array as a
  // dependency, so a fresh array every render would recompute every pfand figure.
  const entries = useMemo(() => mapRows<PfandEntry>(data?.pfandEntries, toPfandEntry), [data])

  const saveEntry = useCallback(
    (input: SavePfandInput): void => run(pfandDb.savePfandEntry(input)),
    [run],
  )

  const deleteEntry = useCallback(
    (entryId: string): void => run(pfandDb.deletePfandEntry(entryId)),
    [run],
  )

  return {
    entries,
    isLoading,
    error,
    saveEntry,
    deleteEntry,
  }
}
