/**
 * The camp list as React state, persisted to localStorage.
 *
 * A *custom hook* is just a function that calls other hooks; the `use` prefix is
 * what lets React (and the lint rules) treat it as one. Extracting it here keeps
 * `App.tsx` about rendering, and lets the storage backend be swapped out without
 * touching a single component.
 */

import { useCallback, useEffect, useReducer, useState } from 'react'
import { loadCamps, saveCamps } from '../db/storage'
import { campNameExists, campsReducer } from '../lib/camps'
import { generateJoinCode } from '../lib/joinCode'
import type { Camp } from '../lib/types'

export type UseCamps = {
  camps: Camp[]
  /** Set when the last createCamp/renameCamp call was rejected; null otherwise. */
  error: string | null
  /** Returns the created camp so the caller can navigate straight into it, or null if the name is taken. */
  createCamp: (name: string) => Camp | null
  renameCamp: (campId: string, name: string) => void
  deleteCamp: (campId: string) => void
  /** Dismiss the current validation error — call it when navigating away from the input that raised it. */
  clearError: () => void
}

export function useCamps(): UseCamps {
  // useReducer(reducer, initialArg, init): React calls `init(initialArg)` once, on the
  // first render only — "lazy initialisation". Reading localStorage is too expensive to
  // redo on every render, and `useState(loadCamps())` would do exactly that.
  const [camps, dispatch] = useReducer(campsReducer, [], loadCamps)

  // Validation failures are a normal UI concern, not a reducer concern — the reducer
  // stays a pure, total function of (state, action). This is separate state so a
  // component can render it as a message and it clears itself on the next attempt.
  const [error, setError] = useState<string | null>(null)

  // An effect synchronising with an external system — localStorage is outside React.
  // It re-runs whenever `camps` changes identity, mirroring the list back to storage.
  useEffect(() => {
    saveCamps(camps)
  }, [camps])

  // useCallback keeps these function identities stable across renders, so children
  // that take them as props don't re-render for no reason. `dispatch` is already stable.
  // `camps` is a dependency here (unlike the other two callbacks) because the name
  // check reads it directly, rather than going through the reducer.
  const createCamp = useCallback(
    (name: string): Camp | null => {
      const trimmed = name.trim()
      if (campNameExists(camps, trimmed)) {
        setError(`A camp named "${trimmed}" already exists.`)
        return null
      }
      setError(null)
      const camp: Camp = { id: generateJoinCode(trimmed), name: trimmed, createdAt: Date.now() }
      dispatch({ type: 'created', camp })
      return camp
    },
    [camps],
  )

  const renameCamp = useCallback(
    (campId: string, name: string): void => {
      const trimmed = name.trim()
      if (campNameExists(camps, trimmed, campId)) {
        setError(`A camp named "${trimmed}" already exists.`)
        return
      }
      setError(null)
      dispatch({ type: 'renamed', campId, name: trimmed })
    },
    [camps],
  )

  const deleteCamp = useCallback((campId: string): void => {
    dispatch({ type: 'deleted', campId })
  }, [])

  const clearError = useCallback((): void => {
    setError(null)
  }, [])

  return { camps, error, createCamp, renameCamp, deleteCamp, clearError }
}
