/**
 * Sign-in, sign-out, and turning an Instant error into something a person can read.
 *
 * Magic codes rather than passwords: two leaders, one shared camp, no password to lose —
 * an email address and a six-digit code is the whole account system. Signing in for the
 * first time creates the account.
 */

import { db } from './instant'

/** Emails a fresh code. Rejects if the address is malformed or the send fails. */
export function sendMagicCode(email: string): Promise<unknown> {
  return db.auth.sendMagicCode({ email })
}

/** Verifies the code and starts the session; creates the account on first use. */
export function signInWithMagicCode(email: string, code: string): Promise<unknown> {
  return db.auth.signInWithMagicCode({ email, code })
}

/** Ends the session and clears the local cache of the signed-in user's data. */
export function signOut(): Promise<void> {
  return db.auth.signOut()
}

/**
 * Instant rejects with an error carrying `body.message` — the useful sentence ("Record not
 * found: app-user-magic-code"). `unknown` is what a `catch` really hands you, so narrow it
 * step by step rather than asserting a shape that may not be there.
 */
export function authErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'body' in error) {
    const body = (error as { body: unknown }).body
    if (typeof body === 'object' && body !== null && 'message' in body) {
      const message = (body as { message: unknown }).message
      if (typeof message === 'string' && message !== '') return message
    }
  }
  if (error instanceof Error && error.message !== '') return error.message
  return fallback
}
