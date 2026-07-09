const MS_PER_DAY = 86_400_000

/** Parse an ISO "YYYY-MM-DD" as a UTC timestamp (ms). */
function toUtcMs(iso: string): number {
  return new Date(iso).getTime()
}

/** Inclusive day count between two ISO dates. dayCount(x, x) === 1. */
export function dayCount(startIso: string, endIso: string): number {
  const diffDays = (toUtcMs(endIso) - toUtcMs(startIso)) / MS_PER_DAY
  return Math.round(diffDays) + 1
}

/** True if `dayIso` falls within [startIso, endIso], endpoints included. */
export function isWithin(dayIso: string, startIso: string, endIso: string): boolean {
  return toUtcMs(startIso) <= toUtcMs(dayIso) && toUtcMs(dayIso) <= toUtcMs(endIso)
}

/**
 * Today as ISO "YYYY-MM-DD" (UTC). The one impure function in this file — it reads
 * the clock. Call it at the *edge* (a component) and pass the result into the pure
 * math, so the math stays testable.
 */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Every ISO day from start to end inclusive, ascending: ["2026-07-01", …]. */
export function eachDay(startIso: string, endIso: string): string[] {
  const isoDates: string[] = []
  for (let ms = toUtcMs(startIso); ms <= toUtcMs(endIso); ms = ms + MS_PER_DAY) {
    // Slicing the UTC ISO string avoids the timezone drift of getDate().
    isoDates.push(new Date(ms).toISOString().slice(0, 10))
  }
  return isoDates
}
