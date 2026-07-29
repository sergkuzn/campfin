export type Camp = {
  id: string
  name: string
  createdAt: number
  startDate?: string // ISO "YYYY-MM-DD"; if unset, derived from per-diem blocks
  endDate?: string // ISO, inclusive
}

/**
 * What a pool is *for*. Reserving a name string would break on rename and on
 * translation, so the reserved thing is a role:
 * - `everyday` — the daily pot, fed by the per-diem grant. Exactly one per camp,
 *   created with the camp, renameable, never deleted. That non-null invariant is what
 *   lets the burn chart and the settlement skip an "is there one yet?" branch.
 * - `earmarked` — a fixed grant with its own purpose.
 * - `deposit` — a Kaution: handed to one counterparty, returned by them, so each gets
 *   a pool of its own.
 */
export type PoolRole = 'everyday' | 'earmarked' | 'deposit'

/**
 * A pot of money you spend from — the thing a receipt is tagged to. How a pool settles
 * (funded − spent, returned at the end) is the same for all of them; `role` says what
 * it means, not how it computes.
 */
export type Pool = {
  id: string
  campId: string
  name: string
  role: PoolRole
  createdAt: number
}

/**
 * Which pool an income kind is allowed to feed. Derived from the kind, never stored:
 * `everyday` = no choice, it joins the daily pot · `choose` = pick a pool or make one ·
 * `own` = always a fresh pool of its own.
 */
export type PoolPolicy = 'everyday' | 'choose' | 'own'

export type PerDiemSource = {
  id: string
  campId: string
  poolId: string
  kind: 'per_diem'
  name: string
  createdAt: number
  // amount is COMPUTED from its blocks, never stored
}

/**
 * A source you type one amount for. `deposit` money is expected back at the end of
 * camp, `fixed` is a plain grant — identical fields, so one type with two possible
 * discriminants rather than two copies. Narrowing still works: `kind === 'per_diem'`
 * picks PerDiemSource, anything else picks this.
 */
export type AmountSource = {
  id: string
  campId: string
  poolId: string
  kind: 'fixed' | 'deposit'
  name: string
  amountCents: number // note the Cents suffix — make the unit unmissable
  createdAt: number
}

export type IncomeSource = PerDiemSource | AmountSource

/** The three entries in the "＋ Add income" menu. */
export type IncomeKind = IncomeSource['kind']

/**
 * `granted` blocks are what the organisation paid for — the receipt for the transfer,
 * never edited to match reality. `actual` blocks are who really came. When a source has
 * no `actual` blocks, actual *is* granted, so the common "nobody dropped out" case
 * stores nothing extra.
 */
export type PerDiemVariant = 'granted' | 'actual'

// A per-diem source is made of one or more blocks: N people over a date range at a rate.
export type PerDiemBlock = {
  id: string
  campId: string
  sourceId: string // → a PerDiemSource
  variant: PerDiemVariant
  label?: string
  numPersons: number
  ratePerPersonDayCents: number
  startDate: string // ISO, inclusive
  endDate: string // ISO, inclusive
}

/** Fields every money movement carries, whatever kind it is. */
type MovementBase = {
  id: string
  campId: string
  name: string
  amountCents: number
  date: string // ISO
  note?: string
  createdAt: number
}

/**
 * Cash changing hands *without* consuming budget — a Kaution left at a shop, or a
 * volunteer's cash you are passing on to the org. It changes what is in your pocket and
 * what you owe, never what you may spend, which is what keeps the burn curve honest.
 *
 * Written as a union rather than one type with `poolId?`, so "a deposit movement names
 * its pool" is checked by the compiler instead of by a comment: narrowing on `kind`
 * gives you `poolId` for the deposit kinds and hides it for volunteer money.
 */
export type DepositMovement = MovementBase & {
  kind: 'deposit_out' | 'deposit_in'
  poolId: string // → a Pool with role 'deposit'
}

export type VolunteerMovement = MovementBase & {
  kind: 'volunteer_in' // no `volunteer_out`: handing it to the org isn't recorded
}

export type Movement = DepositMovement | VolunteerMovement

export type MovementKind = Movement['kind']

/** A quittung (receipt), spent from a pool. */
export type Expense = {
  id: string
  campId: string
  poolId: string // → a Pool, not a source: several sources can fund one wallet
  name: string
  amountCents: number
  date: string // ISO
  note?: string
  enteredBy?: string
  createdAt: number
}
