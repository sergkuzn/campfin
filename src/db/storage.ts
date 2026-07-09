/**
 * The persistence layer: `localStorage`, synchronously. Swapping the *inside* of
 * these two functions for a different backend leaves everything above them (hooks,
 * components) unchanged. That's why it lives here and not in `src/lib/`, which stays
 * pure and I/O-free.
 */

import { isCamp } from '../lib/camps'
import type { Camp } from '../lib/types'

const STORAGE_KEY = 'campfin.camps.v1' // versioned: a v2 shape can migrate rather than crash

/**
 * Never trust what comes back out of storage — it was written by an older build,
 * or hand-edited in devtools. `JSON.parse` returns `unknown`; `isCamp` is what
 * turns it back into a `Camp`. Rows that fail the guard are dropped, not thrown on:
 * one corrupt row shouldn't cost the user their other camps.
 */
export function loadCamps(): Camp[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return []

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    // `.filter(isCamp)` narrows unknown[] → Camp[] because isCamp is a type guard.
    return parsed.filter(isCamp)
  } catch {
    return [] // malformed JSON, or storage disabled (Safari private mode)
  }
}

export function saveCamps(camps: Camp[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(camps))
  } catch {
    // Quota exceeded or storage disabled. Losing a write is bad but crashing is worse.
  }
}
