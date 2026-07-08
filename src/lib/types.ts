export type Camp = {
  id: string
  name: string
  createdAt: number
  startDate?: string // ISO "YYYY-MM-DD"; if unset, derived from per-diem blocks
  endDate?: string // ISO, inclusive
}

export type PerDiemSource = {
  id: string
  campId: string
  kind: 'per_diem'
  use: 'gradual' // per-diem money is always gradual
  name: string
  createdAt: number
  // amount is COMPUTED from its blocks, never stored
}

export type FixedGrantSource = {
  id: string
  campId: string
  kind: 'fixed'
  use: 'gradual' | 'reserved'
  name: string
  fixedAmountCents: number // note the Cents suffix — make the unit unmissable
  createdAt: number
}

export type PassthroughSource = {
  id: string
  campId: string
  kind: 'passthrough'
  use: 'passthrough'
  name: string
  createdAt: number
  // total is COMPUTED from its contributions
}

export type IncomeSource = PerDiemSource | FixedGrantSource | PassthroughSource

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

export type Contribution = {
  id: string
  campId: string
  sourceId: string // → a PassthroughSource
  name: string
  amountCents: number
  date: string // ISO
  createdAt: number
}

// A receipt spent against a gradual or reserved source. Pass-through money is
// forwarded rather than spent, so it has Contributions instead.
export type Expense = {
  id: string
  campId: string
  sourceId: string // → a gradual or reserved IncomeSource
  name: string
  amountCents: number
  date: string // ISO
  note?: string
  enteredBy?: string
  createdAt: number
}
