/**
 * The write/error half that every data hook needs: a write that rejects puts a message on
 * screen, the next attempt clears it, and a failed *load* outranks both — with no rows
 * rendered, nothing else said about them is trustworthy either.
 *
 * Writes are fire-and-forget on purpose. InstantDB applies a transaction to the local copy
 * synchronously, so the screen is already correct before the promise settles; only a
 * rejection — a permission rule, a collision — is news, and then Instant rolls the
 * optimistic rows back on its own.
 */

import { useCallback, useState } from 'react'
import { useT } from '../i18n'

export type WriteState = {
  /** A failed load, else the last write or validation failure, else null. */
  error: string | null
  /** Fire-and-forget a write: clears the last failure, reports a new one. */
  run: (work: Promise<unknown>) => void
  /** Reject something before it ever reaches the database — a taken name, a bad address. */
  fail: (message: string) => void
  clearError: () => void
}

/** @param queryError the `error` of the hook's own `db.useQuery`, when it has one. */
export function useWriteState(queryError?: { message: string }): WriteState {
  const t = useT()
  const [writeError, setWriteError] = useState<string | null>(null)

  // These three keep a stable identity across renders, so a mutator that closes over them
  // can list them as dependencies without being rebuilt on every render — which is the
  // whole point of the `useCallback` wrapping each mutator.
  const run = useCallback(
    (work: Promise<unknown>): void => {
      setWriteError(null)
      void work.catch(() => setWriteError(t.sync.writeFailed))
    },
    [t],
  )

  const fail = useCallback((message: string): void => {
    setWriteError(message)
  }, [])

  const clearError = useCallback((): void => {
    setWriteError(null)
  }, [])

  return {
    error: queryError === undefined ? writeError : t.sync.loadFailed(queryError.message),
    run,
    fail,
    clearError,
  }
}
