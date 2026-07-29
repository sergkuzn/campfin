/**
 * All camps' income as React state, persisted to localStorage. Lazy-initialised reducer
 * + one synchronising effect + stable mutators. Ids and timestamps are minted here so
 * the reducer stays pure.
 */

import { useCallback, useEffect, useReducer } from 'react'
import { loadIncome, saveIncome } from '../db/incomeStorage'
import type { SaveSourceInput } from '../lib/drafts'
import { incomeReducer } from '../lib/income'
import type { IncomeSource, PerDiemBlock, Pool } from '../lib/types'

const newId = () => crypto.randomUUID()

/** The hook's return shape, inferred rather than restated — one place to change. */
export type UseIncome = ReturnType<typeof useIncome>

export function useIncome() {
  const [state, dispatch] = useReducer(incomeReducer, undefined, loadIncome)

  // Mirroring state into localStorage is synchronisation with something outside React,
  // which is what effects are for. Every reducer case that changes data returns a NEW
  // state object, so this fires exactly when the data changed.
  useEffect(() => {
    saveIncome(state)
  }, [state])

  /**
   * Create-or-update one income source with its blocks, and its pool if it's new —
   * a single dispatch, so a half-saved card can never exist. The `existing` row is
   * what carries `id` and `createdAt` across an edit.
   */
  const saveSource = useCallback((input: SaveSourceInput): void => {
    const now = Date.now()
    const sourceId = input.existing?.id ?? newId()
    const createdAt = input.existing?.createdAt ?? now

    const pool: Pool | undefined =
      input.pool.mode === 'new'
        ? { id: newId(), campId: input.campId, name: input.pool.name, createdAt: now }
        : undefined
    const poolId = pool?.id ?? (input.pool.mode === 'existing' ? input.pool.poolId : '')

    const base = { id: sourceId, campId: input.campId, poolId, name: input.name, createdAt }
    const source: IncomeSource =
      input.kind === 'per_diem'
        ? { ...base, kind: 'per_diem' }
        : { ...base, kind: input.kind, amountCents: input.amountCents ?? 0 }

    // Rows the user deleted in the form simply aren't in this array; the reducer
    // replaces the source's whole block set, so they disappear.
    const blocks: PerDiemBlock[] = input.blocks.map((b) => ({
      ...b,
      id: b.id ?? newId(),
      campId: input.campId,
      sourceId,
    }))

    dispatch({ type: 'sourceSaved', source, blocks, pool })
  }, [])

  const deleteSource = useCallback((sourceId: string): void => {
    dispatch({ type: 'sourceDeleted', sourceId })
  }, [])

  const renamePool = useCallback((poolId: string, name: string): void => {
    dispatch({ type: 'poolRenamed', poolId, name })
  }, [])

  const deletePool = useCallback((poolId: string): void => {
    dispatch({ type: 'poolDeleted', poolId })
  }, [])

  return { ...state, saveSource, deleteSource, renamePool, deletePool }
}
