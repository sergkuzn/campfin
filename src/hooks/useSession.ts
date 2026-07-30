/**
 * Who is signed in. A thin, typed view of Instant's auth state so no component has to know
 * that auth comes from the database client at all.
 */

import { useCallback, useMemo } from 'react'
import { signOut as authSignOut } from '../db/auth'
import { db } from '../db/instant'

/** A signed-in user, reduced to what this app is allowed to care about. */
export type Session = {
  userId: string
  /** Shown in the header so you can tell which account a phone is on. Never stored. */
  email: string
}

export type UseSession = {
  session: Session | null
  isLoading: boolean
  error: string | null
  signOut: () => void
}

export function useSession(): UseSession {
  // Instant keeps the session in local storage and refreshes it, so this resolves offline
  // too: a phone at camp with no signal is still signed in.
  const { isLoading, user, error } = db.useAuth()

  const userId = user?.id
  const email = user?.email
  // Depending on the two primitives rather than on `user` keeps the session's identity
  // stable across the re-renders Instant triggers for unrelated reasons.
  const session = useMemo<Session | null>(
    () => (userId === undefined ? null : { userId, email: email ?? '' }),
    [userId, email],
  )

  const signOut = useCallback((): void => {
    // Nothing to do on success — the auth state changes and the tree re-renders. A failed
    // sign-out leaves the session in place, which is the safe direction to fail in.
    void authSignOut()
  }, [])

  return { session, isLoading, error: error?.message ?? null, signOut }
}
