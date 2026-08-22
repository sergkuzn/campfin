/**
 * One camp's income — pools, sources and per-diem blocks — as a live query, plus the writes
 * that change them. Scoped by `campId`, so a screen renders exactly the rows it asked for
 * and nothing has to be filtered afterwards.
 *
 * Rows arrive in no particular order (a database is a set, not a list), so the hook imposes
 * one. Without it a pool could quietly jump above another between two renders.
 */

import { useCallback, useMemo, useState } from 'react'
import * as incomeDb from '../db/incomeDb'
import { db } from '../db/instant'
import { useT } from '../i18n'
import type { SaveBlocksInput, SavePoolInput, SaveSourceInput } from '../lib/drafts'
import type { IncomeState } from '../lib/income'
import { mapRows, toBlock, toPool, toSource } from '../lib/rows'
import type { IncomeSource, PerDiemBlock, Pool, PoolColor } from '../lib/types'

export type UseIncome = IncomeState & {
  isLoading: boolean
  error: string | null
  /** Returns the new pool's id, so the caller can open its income form at once. */
  createPool: (input: SavePoolInput) => string
  saveSource: (input: SaveSourceInput) => void
  /** Replace one variant's block rows — the actual-attendance editor. */
  saveBlocks: (input: SaveBlocksInput) => void
  deleteSource: (sourceId: string) => void
  renamePool: (poolId: string, name: string) => void
  setPoolColor: (poolId: string, color: PoolColor) => void
  deletePool: (poolId: string) => void
}

/** Oldest first, with the id as a tie-break so two rows created in the same millisecond
 *  on two phones still land in the same order on both. */
function byCreation<T extends { id: string; createdAt: number }>(rows: T[]): T[] {
  return rows.toSorted((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
}

/** Blocks have no timestamp; a per-diem card reads best in date order anyway. */
function byStartDate(blocks: PerDiemBlock[]): PerDiemBlock[] {
  return blocks.toSorted(
    (a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id),
  )
}

/** Pass `''` while no camp is open: the query is skipped rather than run for nothing. */
export function useIncome(campId: string): UseIncome {
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
          pools: { $: { where: { campId } } },
          incomeSources: { $: { where: { campId } } },
          perDiemBlocks: { $: { where: { campId } } },
        },
  )

  // One memo for all three arrays: they change together, and every consumer wants the
  // whole slice. `state` is also exactly what the write helpers need to plan a cascade.
  const state = useMemo<IncomeState>(
    () => ({
      pools: byCreation(mapRows<Pool>(data?.pools, toPool)),
      sources: byCreation(mapRows<IncomeSource>(data?.incomeSources, toSource)),
      blocks: byStartDate(mapRows<PerDiemBlock>(data?.perDiemBlocks, toBlock)),
    }),
    [data],
  )

  // Each mutator passes the current rows along, because what a write must *also* write or
  // delete is computed from them. That is why `state` is in every dependency list here.
  const createPool = useCallback(
    (input: SavePoolInput): string => {
      setError(null)
      const { poolId, done } = incomeDb.createPool(input, state)
      void done.catch(() => setError(t.sync.writeFailed))
      return poolId
    },
    [state, t],
  )

  const saveSource = useCallback(
    (input: SaveSourceInput): void => {
      setError(null)
      void incomeDb.saveSource(input, state).catch(() => setError(t.sync.writeFailed))
    },
    [state, t],
  )

  const saveBlocks = useCallback(
    (input: SaveBlocksInput): void => {
      setError(null)
      void incomeDb.saveBlocks(input, state).catch(() => setError(t.sync.writeFailed))
    },
    [state, t],
  )

  const deleteSource = useCallback(
    (sourceId: string): void => {
      setError(null)
      void incomeDb.deleteSource(sourceId, state).catch(() => setError(t.sync.writeFailed))
    },
    [state, t],
  )

  const renamePool = useCallback(
    (poolId: string, name: string): void => {
      setError(null)
      void incomeDb.renamePool(poolId, name).catch(() => setError(t.sync.writeFailed))
    },
    [t],
  )

  const setPoolColor = useCallback(
    (poolId: string, color: PoolColor): void => {
      setError(null)
      void incomeDb.setPoolColor(poolId, color).catch(() => setError(t.sync.writeFailed))
    },
    [t],
  )

  const deletePool = useCallback(
    (poolId: string): void => {
      setError(null)
      void incomeDb.deletePool(poolId, state).catch(() => setError(t.sync.writeFailed))
    },
    [state, t],
  )

  return {
    ...state,
    isLoading,
    error: queryError === undefined ? error : t.sync.loadFailed(queryError.message),
    createPool,
    saveSource,
    saveBlocks,
    deleteSource,
    renamePool,
    setPoolColor,
    deletePool,
  }
}
