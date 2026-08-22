export type Camp = {
  id: string
  name: string
  /**
   * The human-typable code a co-leader enters to join: "MOOR-7F3K". Separate from `id`
   * because database ids are UUIDs, and unique across all camps so one code answers for
   * exactly one camp.
   */
  joinCode: string
  /**
   * Who holds the camp's cash — the leader with the wallet. A name as typed, not an id:
   * payers are free text on the receipt, so this is the same kind of value, compared
   * through `payerKey` so spelling and case never split one person into two.
   *
   * It lives on the camp rather than as a flag per person because "exactly one holder" is
   * an invariant, and a boolean per person cannot express it: two phones offline, each
   * promoting someone different, would merge into two holders with no rule to settle it.
   * One field merges to one winner.
   *
   * Absent until someone is named, and then no receipt owes anybody anything.
   */
  moneyHolder?: string
  createdAt: number
  // No dates of its own: the camp's window is the span of its per-diem blocks, which is
  // the only place camp days are ever entered. One source, so the two cannot disagree.
}

/**
 * What a member may do. `admin` is the leader who created the camp — the only difference
 * today is that deleting the whole camp is offered to them; finer roles are deferred.
 */
export type MemberRole = 'admin' | 'editor'

/**
 * Who may see and edit a camp. No name, no email — a user id and a role, which is all the
 * permission rules need and all this app is allowed to know about a person.
 */
export type Membership = {
  id: string
  campId: string
  userId: string
  role: MemberRole
  createdAt: number
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
 * The roles "＋ Add pool" offers. `Exclude` subtracts a member from a union, so the
 * everyday pool — born with the camp and never created by hand — cannot leak into the
 * form by accident, and adding a fourth role adds it here for free.
 */
export type CreatablePoolRole = Exclude<PoolRole, 'everyday'>

/**
 * How a pool is told apart at a glance. A *token*, not a hex string: the token says which
 * pool this is, and the stylesheet decides what it looks like — so every hue gets a
 * readable value in light and in dark mode, which a colour typed on one phone could not
 * promise on the other.
 */
export type PoolColor = 'blue' | 'teal' | 'green' | 'amber' | 'orange' | 'rose' | 'violet' | 'slate'

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
  /** Optional: pools created before colours existed have none, and `poolColorOf` derives
   *  one from the id instead — so no stored row has to be rewritten. */
  color?: PoolColor
  createdAt: number
}

export type PerDiemSource = {
  id: string
  campId: string
  poolId: string
  kind: 'per_diem'
  /** Optional — see AmountSource.name. */
  name?: string
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
  /**
   * Absent when the pool's name already says it: a pool holding one income needs one
   * name, not two. `sourceLabel` falls back to the pool, so renaming the pool renames
   * the income with it — there is no second copy to keep in step.
   */
  name?: string
  amountCents: number // note the Cents suffix — make the unit unmissable
  createdAt: number
}

export type IncomeSource = PerDiemSource | AmountSource

/**
 * What an income *is*. Never chosen from a menu of three any more: the pool decides it,
 * and `addableKinds` is where that decision lives.
 */
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
 * Cash changing hands *without* consuming budget — a Kaution left at a shop, or the
 * participation fees you are passing on to the org. It changes what is in your pocket and
 * what you owe, never what you may spend, which is what keeps the burn curve honest.
 *
 * Written as a union rather than one type with `poolId?`, so "a deposit movement names
 * its pool" is checked by the compiler instead of by a comment: narrowing on `kind`
 * gives you `poolId` for the deposit kinds and hides it for a fee.
 */
export type DepositMovement = MovementBase & {
  kind: 'deposit_out' | 'deposit_in'
  poolId: string // → a Pool with role 'deposit'
  /**
   * Set on a handover the leader declares final: the counterparty asked for less than the
   * organisation granted, so nothing more is owed even though the amount is short of the
   * deposit. Without it a €150 Kaution out of a €200 grant would look forever half-paid.
   */
  completesDeposit?: boolean
}

/**
 * A participation fee collected from a participant and held for the organisation.
 *
 * The stored `kind` still reads `volunteer_in`: it is the value written to InstantDB and
 * to every JSON export, so renaming it would mean migrating live rows and old dumps for
 * nothing. The name of the concept lives in the type and the dictionary instead.
 */
export type FeeMovement = MovementBase & {
  kind: 'volunteer_in' // no outgoing kind: handing it to the org isn't recorded
}

export type Movement = DepositMovement | FeeMovement

export type MovementKind = Movement['kind']

/** A receipt (receipt), spent from a pool. */
export type Expense = {
  id: string
  campId: string
  poolId: string // → a Pool, not a source: several sources can fund one wallet
  name: string
  amountCents: number
  date: string // ISO
  /**
   * The number written on the paper receipt, so a row in the app and a slip in the folder
   * can be matched by hand. Optional — a receipt is worth entering whether or not it has
   * been filed yet — and a positive integer, unique within the camp, when present.
   */
  number?: number
  note?: string
  /**
   * Whose wallet the money came out of, as typed. Absent means "not tracked" — which is
   * every receipt written before this field existed, and the reason nothing had to be
   * backfilled: an untracked receipt owes nobody.
   *
   * Not to be confused with `enteredBy`, which is about who typed the row into the app.
   */
  paidBy?: string
  /**
   * When the money holder paid this back, in epoch milliseconds. Absent = still owed.
   *
   * A timestamp rather than a boolean: it reads the same in a condition, it records *when*
   * for free, and two phones settling the same receipt merge to the later write instead of
   * to an arbitrary `true`.
   *
   * Deliberately *not* a `Movement`: the budget was consumed when the receipt was paid,
   * whoever's wallet it came from. Booking the payback as a second row would spend the
   * pool twice and bend the burn curve.
   */
  reimbursedAt?: number
  enteredBy?: string
  createdAt: number
}
