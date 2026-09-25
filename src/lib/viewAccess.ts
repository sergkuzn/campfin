/**
 * The participant view link: a read-only window onto one camp, opened without signing in.
 *
 * The link carries a *view code*, and knowing it is the whole permission — the server's
 * rules accept a query that names the camp's current code, until the camp's `viewUntil`
 * has passed. Nothing is stored about who opened it, which is what keeps participants out
 * of the database entirely.
 *
 * Pure: randomness, the clock and the page's address are all passed in.
 */

import { toIsoDate } from './dates'
import { CODE_ALPHABET } from './joinCode'
import type { Camp } from './types'

/**
 * 32 symbols × 16 characters ≈ 2⁸⁰ codes. Far longer than a join code, because a join code
 * only lets a signed-in leader *ask* to join, while this one opens the camp's money to
 * anyone holding it. It travels as a link, so nobody ever has to type it.
 */
export const VIEW_CODE_LENGTH = 16

/** The query-string key the link carries its code under: `https://…/?view=…`. */
export const VIEW_PARAM = 'view'

/**
 * A fresh view code. `random` has `Math.random`'s contract, but the caller should hand in a
 * cryptographic source: this code is a secret, and `Math.random` is guessable.
 */
export function generateViewCode(random: () => number): string {
  let code = ''
  for (let i = 0; i < VIEW_CODE_LENGTH; i++) {
    code += CODE_ALPHABET.charAt(Math.floor(random() * CODE_ALPHABET.length))
  }
  return code
}

/** Whether a string is shaped like a view code — checked before it is sent anywhere, so a
 *  mangled link says "not valid" rather than asking the server about junk. */
export function isViewCode(value: string): boolean {
  return (
    value.length === VIEW_CODE_LENGTH && [...value].every((char) => CODE_ALPHABET.includes(char))
  )
}

/** The code in a page's query string, or null when the page is not a view link. */
export function viewCodeFromSearch(search: string): string | null {
  const code = new URLSearchParams(search).get(VIEW_PARAM)
  return code === null ? null : code.trim().toUpperCase()
}

/** The link a leader shares: the app's own address with the code attached. */
export function viewLink(origin: string, code: string): string {
  return `${origin}/?${VIEW_PARAM}=${code}`
}

/**
 * When access ends for a link open through `lastDayIso`: local midnight at the end of that
 * day, as epoch milliseconds. Stored as an instant rather than a date because the server
 * compares it with its own clock, which knows nothing about the leaders' time zone.
 *
 * `new Date(y, m, d + 1)` rolls over month and year ends on its own, and daylight-saving
 * shifts too, since it works in local calendar days rather than in 24-hour steps.
 */
export function viewUntilFor(lastDayIso: string): number {
  const [year, month, day] = lastDayIso.split('-').map(Number)
  return new Date(year ?? 0, (month ?? 1) - 1, (day ?? 1) + 1).getTime()
}

/** The last day a stored `viewUntil` still admits — the inverse of `viewUntilFor`. */
export function lastViewDay(viewUntil: number): string {
  return toIsoDate(new Date(viewUntil - 1))
}

/**
 * The link's state as the camp settings describe it. `off` = no link exists; `open` and
 * `closed` both have one, on either side of its end.
 */
export type ViewAccess =
  | { state: 'off' }
  | { state: 'open' | 'closed'; code: string; lastDayIso: string }

export function viewAccess(camp: Camp, nowMs: number): ViewAccess {
  if (camp.viewCode === undefined || camp.viewUntil === undefined) return { state: 'off' }
  return {
    state: nowMs < camp.viewUntil ? 'open' : 'closed',
    code: camp.viewCode,
    lastDayIso: lastViewDay(camp.viewUntil),
  }
}

/**
 * Whether the link would close before the camp does. The end date is copied from the camp
 * when the link is made, so a camp lengthened afterwards leaves it behind — this is what
 * lets the settings screen say so rather than letting participants lose the last days.
 */
export function endsBeforeCamp(lastDayIso: string, campEndIso: string): boolean {
  return lastDayIso < campEndIso
}
