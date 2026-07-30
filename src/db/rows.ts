/**
 * The untrusted boundary. A query result is not proof: rows may have been written by an
 * older build, by the other phone running a newer one, or read back from the offline cache.
 * Each mapper validates a row with the guard from `src/lib/`, then picks out exactly the
 * fields the domain type declares — so a nested `members` array from a query never leaks
 * into a `Camp`, and one broken row costs the user that row, not the screen.
 */

import { isCamp } from '../lib/camps'
import { isIncomeSource, isPerDiemBlock, isPool } from '../lib/income'
import { isMembership } from '../lib/members'
import type { Camp, IncomeSource, Membership, PerDiemBlock, Pool } from '../lib/types'

/**
 * An optional attribute nobody has set can come back as `null`, while the domain types
 * spell "absent" as `undefined` — and the guards read a `null` label as the wrong type and
 * would reject the whole row. Dropping null-valued keys first makes the two agree.
 */
function withoutNulls(row: unknown): unknown {
  if (typeof row !== 'object' || row === null) return row
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== null))
}

/** Rows that map cleanly, in query order. Unmappable ones are skipped, never thrown on. */
export function mapRows<T>(
  rows: readonly unknown[] | undefined,
  to: (row: unknown) => T | null,
): T[] {
  if (rows === undefined) return []
  const mapped: T[] = []
  for (const row of rows) {
    const value = to(row)
    if (value !== null) mapped.push(value)
  }
  return mapped
}

export function toCamp(row: unknown): Camp | null {
  const value = withoutNulls(row)
  if (!isCamp(value)) return null
  const { id, name, joinCode, createdAt, startDate, endDate } = value
  return { id, name, joinCode, createdAt, startDate, endDate }
}

export function toMembership(row: unknown): Membership | null {
  const value = withoutNulls(row)
  if (!isMembership(value)) return null
  const { id, campId, userId, role, createdAt } = value
  return { id, campId, userId, role, createdAt }
}

export function toPool(row: unknown): Pool | null {
  const value = withoutNulls(row)
  if (!isPool(value)) return null
  const { id, campId, name, role, createdAt } = value
  return { id, campId, name, role, createdAt }
}

export function toSource(row: unknown): IncomeSource | null {
  const value = withoutNulls(row)
  if (!isIncomeSource(value)) return null
  const { id, campId, poolId, name, createdAt } = value
  // Narrowing on `kind` is what makes `amountCents` visible at all — a per-diem source
  // has no stored amount, so copying the field unconditionally would invent one.
  return value.kind === 'per_diem'
    ? { id, campId, poolId, name, createdAt, kind: 'per_diem' }
    : { id, campId, poolId, name, createdAt, kind: value.kind, amountCents: value.amountCents }
}

export function toBlock(row: unknown): PerDiemBlock | null {
  const value = withoutNulls(row)
  if (!isPerDiemBlock(value)) return null
  const { id, campId, sourceId, variant, label } = value
  const { numPersons, ratePerPersonDayCents, startDate, endDate } = value
  return {
    id,
    campId,
    sourceId,
    variant,
    label,
    numPersons,
    ratePerPersonDayCents,
    startDate,
    endDate,
  }
}
