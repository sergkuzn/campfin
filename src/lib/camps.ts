/**
 * Pure camp-list logic: the row guard, validation, ordering and lifecycle status.
 * No React, no storage, no `Date.now()` — "today" and new rows are always passed in.
 */

import { isWithin } from './dates'
import type { Camp } from './types'

/** Where a camp sits in time. `draft` = no dates entered yet (income setup not done). */
export type CampStatus = 'draft' | 'upcoming' | 'running' | 'finished'

/**
 * A *type guard*: the `value is Camp` return type tells TypeScript that when this
 * returns true, `value` may be treated as a `Camp` from there on. It's the bridge
 * from `unknown` (what `JSON.parse` gives you) into the typed world — the one place
 * a runtime check earns a compile-time promise.
 */
export function isCamp(value: unknown): value is Camp {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const c = value as Record<string, unknown>
  if (
    typeof c.id !== 'string' ||
    typeof c.name !== 'string' ||
    typeof c.joinCode !== 'string' ||
    typeof c.createdAt !== 'number'
  ) {
    return false
  }
  if (c.startDate !== undefined && typeof c.startDate !== 'string') {
    return false
  }
  if (c.endDate !== undefined && typeof c.endDate !== 'string') {
    return false
  }
  return true
}

/** True if another camp already has this name. Pass `excludeCampId` when renaming, so a camp doesn't collide with itself. */
export function campNameExists(camps: Camp[], name: string, excludeCampId?: string): boolean {
  return camps.some((camp) => camp.name === name && camp.id !== excludeCampId)
}

/**
 * A name no other camp holds: "Moorwiese" → "Moorwiese (2)" → "Moorwiese (3)". Used when
 * importing a dump next to the camp it came from, where refusing the write would be worse
 * than a suffix — the user asked for a copy and can rename it afterwards.
 */
export function uniqueCampName(camps: Camp[], name: string): string {
  if (!campNameExists(camps, name)) return name
  // Bounded by the number of camps: with n camps at most n suffixes can be taken, so the
  // n+1st is always free and this cannot loop forever.
  for (let suffix = 2; suffix <= camps.length + 1; suffix++) {
    const candidate = `${name} (${suffix})`
    if (!campNameExists(camps, candidate)) return candidate
  }
  return name
}

/** Newest first. Must not mutate the input — `.sort()` sorts in place. */
export function sortCampsByRecent(camps: Camp[]): Camp[] {
  return camps.toSorted((a, b) => b.createdAt - a.createdAt)
}

/**
 * `draft` when the camp has no window yet; otherwise compare `todayIso` against it.
 * ISO "YYYY-MM-DD" strings compare correctly with `<` / `>` — their digit order is
 * their chronological order — so no Date parsing is needed here.
 */
export function campStatus(camp: Camp, todayIso: string): CampStatus {
  if (!camp.startDate || !camp.endDate) {
    return 'draft'
  }
  if (isWithin(todayIso, camp.startDate, camp.endDate)) {
    return 'running'
  }
  if (todayIso < camp.startDate) {
    return 'upcoming'
  }
  return 'finished'
}

// The camp list itself is no longer local state: InstantDB owns it, a live query reads it
// and `src/db/campsDb.ts` writes it. What stays here is the pure logic a screen needs
// before or after such a write — validation, ordering and status.
