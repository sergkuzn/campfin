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
  /**
   * The entry cards this camp does not use, as a comma-separated list of `EntrySlot` keys.
   * Read through `parseHiddenSlots`, which is where the string becomes a typed set.
   *
   * Stored on the camp so both leaders' dashboards agree, and as one field rather than a
   * flag per card so the list can grow without a schema change each time. Absent on a camp
   * that has never hidden anything, which is every camp until someone taps Customise.
   */
  hiddenEntries?: string
  /**
   * The secret in the participants' read-only link. Absent while the camp has none; a new
   * one replaces it, which is how a leaked link is shut. Read through `viewAccess`.
   */
  viewCode?: string
  /**
   * When the link stops working, as epoch milliseconds. Written together with `viewCode`,
   * and an instant rather than a date because the server compares it with its own clock.
   */
  viewUntil?: number
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
 * What an account may do *across the app*, as opposed to `MemberRole`, which only ever
 * describes one camp. `leader` starts camps of their own up to a quota; `admin` runs the
 * instance — sees every camp and hands out the grants.
 */
export type AccountRole = 'admin' | 'leader'

/**
 * Permission to start camps at all: the row that turns a signed-in stranger into a leader.
 *
 * Signing up cannot be closed — an invited co-leader has to be able to create an account
 * before anyone knows who they are — so the gate sits here instead. No account row means
 * the app is inert: you may still join a camp whose code you were given, which keeps
 * inviting a co-leader a matter between the two leaders and nobody else.
 *
 * The email is the one address this app stores itself. It has to be: a grant can be
 * written before that person has ever signed in, so there is no user row to read it from
 * yet, and the admin screen has nothing else to name a person by.
 */
export type Account = {
  id: string
  email: string
  role: AccountRole
  /** How many camps this person may create. Ignored for `admin`, who is never metered. */
  campQuota: number
  grantedAt: number
}

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
   * The deposit charged on this receipt, in cents. Absent means none, which is nearly
   * every receipt.
   *
   * Pfand is never the group's money: whoever paid the receipt is out this much of their
   * own until it is reclaimed. That is why `amountCents` above is *normalised* at save
   * time to the money the pool actually spent — every sum in `budget.ts`, `burn.ts`,
   * `pools.ts` and `report.ts` adds up receipts without knowing pfand exists, and none of
   * them can forget to subtract it.
   */
  pfandPaidCents?: number
  /** The deposit refunded on the same receipt, in cents. Absent means none. */
  pfandReturnedCents?: number
  /**
   * Which number was typed into the amount box: `true` for the whole receipt total with the pfand
   * folded inside it, absent for the goods alone with the pfand entered beside them.
   *
   * Editor memory, nothing more — `amountCents` means the same thing either way. Without
   * it, re-opening a receipt would show a number the paper slip does not have.
   */
  pfandInTotal?: boolean
  /**
   * Whose wallet the money came out of, as typed. Absent means "not tracked" — which is
   * every receipt written before this field existed, and the reason nothing had to be
   * backfilled: an untracked receipt owes nobody.
   *
   * Not to be confused with `enteredBy`, which is about who typed the row into the app.
   */
  paidBy?: string
  /**
   * Whether the money holder has paid this back. Absent/false = still owed.
   *
   * Deliberately *not* a `Movement`: the budget was consumed when the receipt was paid,
   * whoever's wallet it came from. Booking the payback as a second row would spend the
   * pool twice and bend the burn curve.
   */
  reimbursed?: boolean
  enteredBy?: string
  createdAt: number
}

/**
 * What a stored pfand row records — one thing only: packaging taken back to a shop for
 * cash, buying nothing.
 *
 * Every other pfand fact is derived rather than stored. A deposit charged or refunded at a
 * till is two amounts on the receipt that carries them, and a deposit changing owner —
 * what happens when the money holder pays back the person who fronted it — is read off
 * that receipt's `reimbursed` flag. Nothing about a receipt is therefore copied into a row
 * that could go stale when the receipt is edited, or be left behind when it is deleted.
 *
 * A single-valued `kind` is kept on the row on purpose: it is what makes a row written by
 * an earlier build, when a handover *was* stored, fall out at the guard rather than be
 * counted a second time on top of the derived one.
 */
export type PfandEntryKind = 'refund'

/** Deposit money coming back into one person's pocket at a shop, outside any receipt. */
export type PfandEntry = {
  id: string
  campId: string
  kind: PfandEntryKind
  /**
   * Whose own money this is, as typed. The same kind of value as `Expense.paidBy` and
   * `Camp.moneyHolder` — free text, compared through `payerKey`, so pfand needs no
   * namespace of people and no id to remap on import.
   */
  payer: string
  /** Always positive. Which way it moves is the kind's business, not the sign's. */
  amountCents: number
  date: string // ISO
  note?: string
  createdAt: number
}

/**
 * Money spent on the camp that no income pool pays for: a leader buys something out of
 * their own pocket, and the organisation compensates it afterwards.
 *
 * A namespace of its own rather than an `Expense` with no pool. Every sum in `budget.ts`,
 * `burn.ts` and `pools.ts` is a plain sum over receipts keyed by pool, and a poolless
 * receipt would have to be branched around in each of them — while the report, which is
 * the only place this money is counted, adds it once. It is not a `Movement` either: a
 * movement is camp cash changing hands, this is a leader's own cash leaving for good.
 *
 * There is no pfand here and no receipt number: what is being recorded is a claim on the
 * organisation, not a slip in the camp's folder.
 */
export type OtherExpense = {
  id: string
  campId: string
  name: string
  amountCents: number
  date: string // ISO
  note?: string
  /**
   * Whose own money it was, as typed — the same free-text payer as `Expense.paidBy`,
   * compared through `payerKey`. Required rather than optional: this namespace is new, so
   * unlike a receipt there is no row from an older build with the answer missing.
   */
  paidBy: string
  /**
   * Whether the money holder has taken this claim over from the person who fronted it.
   * Absent/false = that person is still the one out of pocket.
   *
   * It says nothing about the organisation having paid: what they still owe is the
   * report's total, and it is a claim against them until the camp is settled off-app.
   */
  reimbursed?: boolean
  createdAt: number
}
