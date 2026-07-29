export type Camp = {
  id: string
  name: string
  createdAt: number
  startDate?: string // ISO "YYYY-MM-DD"; if unset, derived from per-diem blocks
  endDate?: string // ISO, inclusive
}

/**
 * A pot of money you spend from — the thing a receipt is tagged to. Just a name:
 * how a pool settles (funded − spent, returned at the end) is the same for all of
 * them, so there is no behaviour flag to get wrong.
 */
export type Pool = {
  id: string
  campId: string
  name: string
  createdAt: number
}

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

// A per-diem source is made of one or more blocks: N people over a date range at a rate.
export type PerDiemBlock = {
  id: string
  campId: string
  sourceId: string // → a PerDiemSource
  label?: string
  numPersons: number
  ratePerPersonDayCents: number
  startDate: string // ISO, inclusive
  endDate: string // ISO, inclusive
}

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
