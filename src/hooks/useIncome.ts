/**
 * All camps' income as React state, persisted to localStorage. Same shape as
 * `useCamps`: lazy-initialised reducer + one synchronising effect + stable mutators.
 * Ids and timestamps are minted here, at the edge, so the reducer stays pure.
 */

import { useCallback, useEffect, useReducer } from 'react'
import { loadIncome, saveIncome } from '../db/incomeStorage'
import { incomeReducer } from '../lib/income'
import type {
  Contribution,
  FixedGrantSource,
  PassthroughSource,
  PerDiemBlock,
  PerDiemSource,
} from '../lib/types'

const newId = () => crypto.randomUUID()

/** The hook's return shape, inferred rather than restated — one place to change. */
export type UseIncome = ReturnType<typeof useIncome>

export function useIncome() {
  // Lazy init: loadIncome() runs once on the first render, reading all three namespaces.
  const [state, dispatch] = useReducer(incomeReducer, undefined, loadIncome)

  // Mirroring state into localStorage is synchronisation with something outside React,
  // which is what effects are for. Every reducer case returns a NEW state object, so
  // this fires exactly when the data changed.
  useEffect(() => {
    saveIncome(state)
  }, [state])

  const addPerDiemSource = useCallback((campId: string, name: string): PerDiemSource => {
    const source: PerDiemSource = {
      id: newId(),
      campId,
      kind: 'per_diem',
      use: 'gradual',
      name,
      createdAt: Date.now(),
    }
    dispatch({ type: 'sourceAdded', source })
    return source
  }, [])

  const addFixedGrant = useCallback(
    (
      campId: string,
      name: string,
      use: 'gradual' | 'reserved',
      fixedAmountCents: number,
    ): FixedGrantSource => {
      const source: FixedGrantSource = {
        id: newId(),
        campId,
        kind: 'fixed',
        use,
        name,
        fixedAmountCents,
        createdAt: Date.now(),
      }
      dispatch({ type: 'sourceAdded', source })
      return source
    },
    [],
  )

  const addPassthroughSource = useCallback((campId: string, name: string): PassthroughSource => {
    const source: PassthroughSource = {
      id: newId(),
      campId,
      kind: 'passthrough',
      use: 'passthrough',
      name,
      createdAt: Date.now(),
    }
    dispatch({ type: 'sourceAdded', source })
    return source
  }, [])

  const deleteSource = useCallback((sourceId: string): void => {
    dispatch({ type: 'sourceDeleted', sourceId })
  }, [])

  // `Omit<PerDiemBlock, 'id'>` is "every field of PerDiemBlock except id" — the caller
  // supplies the data, the hook supplies identity. Components never mint ids.
  const addBlock = useCallback((draft: Omit<PerDiemBlock, 'id'>): void => {
    dispatch({ type: 'blockAdded', block: { ...draft, id: newId() } })
  }, [])

  const deleteBlock = useCallback((blockId: string): void => {
    dispatch({ type: 'blockDeleted', blockId })
  }, [])

  const addContribution = useCallback((draft: Omit<Contribution, 'id' | 'createdAt'>): void => {
    dispatch({
      type: 'contributionAdded',
      contribution: { ...draft, id: newId(), createdAt: Date.now() },
    })
  }, [])

  const deleteContribution = useCallback((contributionId: string): void => {
    dispatch({ type: 'contributionDeleted', contributionId })
  }, [])

  return {
    ...state,
    addPerDiemSource,
    addFixedGrant,
    addPassthroughSource,
    deleteSource,
    addBlock,
    deleteBlock,
    addContribution,
    deleteContribution,
  }
}
