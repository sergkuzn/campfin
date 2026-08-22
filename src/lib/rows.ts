/**
 * The untrusted boundary. Data that claims to be a row is not proof: it may have been
 * written by an older build, by the other phone running a newer one, read back from the
 * offline cache, or typed by hand into an exported JSON file. Each mapper validates with
 * the matching guard, then picks out exactly the fields the domain type declares — so a
 * nested `members` array from a query never leaks into a `Camp`, and one broken row costs
 * the user that row, not the screen.
 *
 * Pure, and used from both sides: the live queries in `src/hooks/` and the JSON import in
 * `importJson.ts` face the same problem, so they share one definition of it.
 */

import { isCamp } from './camps'
import { isExpense } from './expenses'
import { isIncomeSource, isMovement, isPerDiemBlock, isPool } from './income'
import { isMembership } from './members'
import { isPoolColor } from './poolColors'
import type { Camp, Expense, IncomeSource, Membership, Movement, PerDiemBlock, Pool } from './types'

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
  const { id, name, joinCode, moneyHolder, createdAt } = value
  return { id, name, joinCode, moneyHolder, createdAt }
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
  const { id, campId, name, role, color, createdAt } = value
  // A hue this build has no value for is dropped rather than carried: `poolColorOf` then
  // derives one from the id, which is better than a pool drawn in nothing at all.
  return { id, campId, name, role, color: isPoolColor(color) ? color : undefined, createdAt }
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

export function toMovement(row: unknown): Movement | null {
  const value = withoutNulls(row)
  if (!isMovement(value)) return null
  const { id, campId, name, amountCents, date, note, createdAt } = value
  const common = { id, campId, name, amountCents, date, note, createdAt }
  // Narrowing on `kind` is what makes `poolId` visible: copying it unconditionally would
  // give a participation fee a pool it does not have.
  return value.kind === 'volunteer_in'
    ? { ...common, kind: value.kind }
    : {
        ...common,
        kind: value.kind,
        poolId: value.poolId,
        completesDeposit: value.completesDeposit,
      }
}

export function toExpense(row: unknown): Expense | null {
  const value = withoutNulls(row)
  if (!isExpense(value)) return null
  const { id, campId, poolId, name, amountCents, date, number, note, createdAt } = value
  const { paidBy, reimbursedAt, enteredBy } = value
  return {
    id,
    campId,
    poolId,
    name,
    amountCents,
    date,
    number,
    note,
    paidBy,
    reimbursedAt,
    enteredBy,
    createdAt,
  }
}
