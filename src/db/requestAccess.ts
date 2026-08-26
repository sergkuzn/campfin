/**
 * Asks the host to tell the admins that this account is waiting to be activated.
 *
 * The one outbound call in the app that is not InstantDB, and it lives here all the same:
 * it carries the session's refresh token, and "no component ever holds a token" is the rule
 * this folder exists to keep.
 *
 * What answers on the other end is `api/request-access.ts`, which verifies the token with
 * Instant before it believes anything about who is asking.
 */

import { db } from './instant'

/** Same origin as the app, so the function ships with the build and no CORS is involved. */
const ENDPOINT = '/api/request-access'

/**
 * Resolves whether or not anyone was actually reached. A leader who cannot reach the
 * endpoint — offline, or a host with no functions deployed — must still be able to join a
 * camp by code, so this never rejects and never throws into the render tree. The admin
 * screen lists everyone waiting regardless, so a lost notification costs a delay, not the
 * grant.
 */
export async function requestAccess(): Promise<void> {
  try {
    const user = await db.getAuth()
    // No session, no token to prove anything with — and nothing to announce either.
    if (user === null) return
    await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: user.refresh_token }),
    })
  } catch {
    // Deliberately silent. See above: this is a convenience, not a step in any flow.
  }
}
