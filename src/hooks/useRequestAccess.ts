/**
 * Announces a signed-in account that nobody has activated yet — at most once per account
 * per device.
 *
 * An effect is the right tool for once. This synchronises with something outside React —
 * the host's notify endpoint — in response to a state the app *finds itself in*, not to
 * anything the user just did. There is no event to hang it on: signing in for the first
 * time is the event, and it already happened before this component rendered.
 */

import { useEffect } from 'react'
import { requestAccess } from '../db/requestAccess'

/**
 * The "already asked" mark. Keyed by user id so signing in as somebody else on a shared
 * phone still announces them, and kept in storage because nothing in the database records
 * having asked.
 */
function askedKey(userId: string): string {
  return `campfin.accessRequested.${userId}`
}

function alreadyAsked(userId: string): boolean {
  try {
    return localStorage.getItem(askedKey(userId)) !== null
  } catch {
    // Private-mode browsers throw on storage. Losing the mark risks a duplicate message and
    // nothing worse, so treat it as "not asked yet" and carry on.
    return false
  }
}

function markAsked(userId: string): void {
  try {
    localStorage.setItem(askedKey(userId), String(Date.now()))
  } catch {
    // As above — the endpoint refuses to send twice for anyone already granted anyway.
  }
}

/**
 * @param userId  who is signed in; `''` while nobody is.
 * @param needsActivation  signed in, the account query has *settled*, and there is no grant.
 *   The caller has to wait for the query rather than passing `account === null` straight
 *   through: that is also what an unresolved query looks like, and it would announce every
 *   already-granted leader on every cold start.
 */
export function useRequestAccess(userId: string, needsActivation: boolean): void {
  useEffect(() => {
    if (!needsActivation || userId === '' || alreadyAsked(userId)) return
    // Marked before the call, not after. A request that failed is not worth repeating on
    // every render, and the same request from a second device would only be a duplicate.
    markAsked(userId)
    void requestAccess()
  }, [userId, needsActivation])
}
