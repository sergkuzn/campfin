/**
 * Pure camp-list logic: validation, ordering, lifecycle status, and the reducer
 * that owns the camp list. No React, no storage, no `Date.now()` — "today" and
 * new rows are always passed in.
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
  if (typeof c.id !== 'string' || typeof c.name !== 'string' || typeof c.createdAt !== 'number') {
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

/** Human label for the status pill. */
export function describeCampStatus(status: CampStatus): string {
  switch (status) {
    case 'draft':
      return 'No dates yet'
    case 'upcoming':
      return 'Upcoming'
    case 'running':
      return 'Running'
    case 'finished':
      return 'Finished'
    default: {
      const _never: never = status
      return _never
    }
  }
}

// --- The reducer -----------------------------------------------------------
// A *reducer* is `(state, action) => newState`: one pure function that owns every
// legal transition of the camp list. React's `useReducer` calls it for you. The
// action is a discriminated union on `type`, so `switch (action.type)` narrows to
// exactly the fields that action carries — the same trick as IncomeSource's `kind`.

export type CampsAction =
  | { type: 'loaded'; camps: Camp[] }
  | { type: 'created'; camp: Camp }
  | { type: 'renamed'; campId: string; name: string }
  | { type: 'deleted'; campId: string }

export function campsReducer(state: Camp[], action: CampsAction): Camp[] {
  switch (action.type) {
    case 'loaded':
      return action.camps
    case 'created':
      return [...state, action.camp]
    case 'renamed':
      return state.map((camp) =>
        camp.id === action.campId ? { ...camp, name: action.name } : camp,
      )
    case 'deleted':
      return state.filter((camp) => camp.id !== action.campId)
    default: {
      const _never: never = action
      return _never
    }
  }
}
