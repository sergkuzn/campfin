/**
 * Pure camp-list logic: the row guard, validation, ordering and lifecycle status.
 * No React, no storage, no `Date.now()` — "today" and new rows are always passed in.
 */

import { effectiveBlocks } from './budget'
import { isWithin } from './dates'
import type { Camp, PerDiemBlock } from './types'

/** Where a camp sits in time. `draft` = nothing dates it yet — no per-diem blocks. */
export type CampStatus = 'draft' | 'upcoming' | 'running' | 'finished'

/** The days a camp spans, inclusive at both ends. */
export type CampWindow = { startIso: string; endIso: string }

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
  return c.moneyHolder === undefined || typeof c.moneyHolder === 'string'
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

/** ISO dates sort chronologically as plain strings, so min/max need no Date parsing. */
function earliest(isoDates: string[]): string | undefined {
  return isoDates.toSorted().at(0)
}

function latest(isoDates: string[]): string | undefined {
  return isoDates.toSorted().at(-1)
}

/**
 * The camp's days: the span of the blocks that describe who really came — a source's
 * `actual` blocks when it has any, its `granted` ones otherwise.
 *
 * This is the camp's *only* window. It is derived rather than stored so it cannot drift
 * from the blocks the money is computed from: shorten a stay and the camp shortens with
 * it. `null` when nothing dates the camp at all — a camp with no per-diem income yet has
 * no window, and inventing one would draw a chart out of nothing.
 */
export function campWindow(blocks: PerDiemBlock[]): CampWindow | null {
  const reality = realityBlocks(blocks)
  const startIso = earliest(reality.map((b) => b.startDate))
  const endIso = latest(reality.map((b) => b.endDate))

  if (startIso === undefined || endIso === undefined) return null
  // A window that ends before it starts is a typo, not a camp; `eachDay` would return
  // an empty list anyway, and `null` says why.
  if (startIso > endIso) return null

  return { startIso, endIso }
}

/**
 * The blocks that describe reality, across every source in the list. Resolving each
 * source separately is what lets one source be corrected to `actual` while another still
 * runs on `granted`.
 */
export function realityBlocks(blocks: PerDiemBlock[]): PerDiemBlock[] {
  const sourceIds = [...new Set(blocks.map((b) => b.sourceId))]
  return sourceIds.flatMap((sourceId) => effectiveBlocks(blocks, sourceId))
}

/**
 * `draft` when the camp has no window yet; otherwise compare `todayIso` against it.
 * ISO "YYYY-MM-DD" strings compare correctly with `<` / `>` — their digit order is
 * their chronological order — so no Date parsing is needed here.
 */
export function campStatus(window: CampWindow | null, todayIso: string): CampStatus {
  if (window === null) {
    return 'draft'
  }
  if (isWithin(todayIso, window.startIso, window.endIso)) {
    return 'running'
  }
  if (todayIso < window.startIso) {
    return 'upcoming'
  }
  return 'finished'
}

// The camp list itself is no longer local state: InstantDB owns it, a live query reads it
// and `src/db/campsDb.ts` writes it. What stays here is the pure logic a screen needs
// before or after such a write — validation, ordering and status.
