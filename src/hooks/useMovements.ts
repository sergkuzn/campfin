/**
 * One camp's custody movements as a live query, plus the two writes that change them.
 * Scoped by `campId`, exactly like `useExpenses` — the two namespaces stay apart because
 * custody money never consumes budget.
 */

import { useCallback, useMemo } from 'react'
import { db } from '../db/instant'
import * as movementsDb from '../db/movementsDb'
import type { SaveMovementInput } from '../lib/movements'
import { mapRows, toMovement } from '../lib/rows'
import type { Movement } from '../lib/types'
import { useWriteState } from './useWriteState'

export type UseMovements = {
  /** Newest first. */
  movements: Movement[]
  isLoading: boolean
  error: string | null
  saveMovement: (input: SaveMovementInput) => void
  deleteMovement: (movementId: string) => void
}

/** Pass `''` while no camp is open: the query is skipped rather than run for nothing. */
export function useMovements(campId: string): UseMovements {
  const {
    isLoading,
    error: queryError,
    data,
  } = db.useQuery(
    campId === ''
      ? null
      : {
          // Ordering by an indexed attribute lets the server do it; `sortMovements`
          // downstream breaks the same-day ties identically on both phones.
          movements: { $: { where: { campId }, order: { date: 'desc' } } },
        },
  )

  const { error, run } = useWriteState(queryError)

  // Memoised on the query result: the deposit statuses take this array as a dependency, so
  // a fresh array every render would recompute every custody figure.
  const movements = useMemo(() => mapRows<Movement>(data?.movements, toMovement), [data])

  const saveMovement = useCallback(
    (input: SaveMovementInput): void => run(movementsDb.saveMovement(input)),
    [run],
  )

  const deleteMovement = useCallback(
    (movementId: string): void => run(movementsDb.deleteMovement(movementId)),
    [run],
  )

  return {
    movements,
    isLoading,
    error,
    saveMovement,
    deleteMovement,
  }
}
