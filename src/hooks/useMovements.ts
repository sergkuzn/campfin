/**
 * One camp's custody movements as a live query, plus the two writes that change them.
 * Scoped by `campId`, exactly like `useExpenses` — the two namespaces stay apart because
 * custody money never consumes budget.
 */

import { useCallback, useMemo, useState } from 'react'
import { db } from '../db/instant'
import * as movementsDb from '../db/movementsDb'
import { useT } from '../i18n'
import type { SaveMovementInput } from '../lib/movements'
import { mapRows, toMovement } from '../lib/rows'
import type { Movement } from '../lib/types'

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
          // Ordering by an indexed attribute lets the server do it; `sortMovements`
          // downstream breaks the same-day ties identically on both phones.
          movements: { $: { where: { campId }, order: { date: 'desc' } } },
        },
  )

  // Memoised on the query result: the deposit statuses take this array as a dependency, so
  // a fresh array every render would recompute every custody figure.
  const movements = useMemo(() => mapRows<Movement>(data?.movements, toMovement), [data])

  const saveMovement = useCallback(
    (input: SaveMovementInput): void => {
      setError(null)
      void movementsDb.saveMovement(input).catch(() => setError(t.sync.writeFailed))
    },
    [t],
  )

  const deleteMovement = useCallback(
    (movementId: string): void => {
      setError(null)
      void movementsDb.deleteMovement(movementId).catch(() => setError(t.sync.writeFailed))
    },
    [t],
  )

  return {
    movements,
    isLoading,
    error: queryError === undefined ? error : t.sync.loadFailed(queryError.message),
    saveMovement,
    deleteMovement,
  }
}
