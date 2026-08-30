/**
 * Pfand — the deposit charged on returnable packaging — as pure data. No React, no
 * database, no clock.
 *
 * The rule the whole module follows: **pfand is never the group's money.** The person who
 * paid the receipt put it down out of their own pocket and gets it back when the deposit
 * go back. So `Expense.amountCents` is normalised on write to the money the pool actually
 * spent, and `budget.ts`, `burn.ts`, `pools.ts` and `report.ts` go on summing receipts
 * without knowing pfand exists. What is left here is two jobs:
 *
 * - **the arithmetic on the slip** (`receiptGroupCents`), which is where the two ways of
 *   typing an amount are resolved into one meaning;
 * - **the ledger** (`pfandLedger`, `pfandBalances`), a running per-person balance derived
 *   from receipts and from the entries typed away from a shop counter.
 *
 * The ledger is derived on every render and stores nothing of its own. In particular a
 * deposit changing owner — the money holder paying back the person who fronted it — is read
 * off that receipt's `reimbursed` flag rather than written as a row: receipts are edited,
 * deleted and created out of order, and a stored copy of one would quietly go on describing
 * a receipt that has since changed.
 *
 * A payer is a name, not a row — the same choice `payers.ts` makes and for the same
 * reasons. Every question here goes through `payerKey`, so a stray capital never splits
 * one pocket in two.
 */

import { parseEurosToCents } from './money'
import { isSamePayer, payerKey } from './payers'
import type { Expense, PfandEntry } from './types'

// --- On the receipt ----------------------------------------------------------

/**
 * What the pool actually spent, from the number that was typed.
 *
 * `pfandInTotal` says which number that was. With the pfand *inside* the till total, the
 * deposit charged has to come out — it bought no goods — and a deposit refunded has to go
 * back in, because the shop took it off the total but it was the payer's
 * own money coming home, not a discount on the shopping. With the pfand entered *beside*
 * the amount, the amount was already the goods and nothing moves.
 */
export function receiptGroupCents(
  typedCents: number,
  paidCents: number,
  returnedCents: number,
  pfandInTotal: boolean,
): number {
  return pfandInTotal ? typedCents - paidCents + returnedCents : typedCents
}

/**
 * What the paper slip says, derived rather than stored: the goods plus the deposit put
 * down, less the deposit taken back. One formula for both typing modes — `amountCents`
 * means the same thing either way, so the till total does too.
 */
export function receiptTotalCents(expense: Expense): number {
  return expense.amountCents + pfandPaid(expense) - pfandReturned(expense)
}

/**
 * The deposit this receipt put into its payer's pocket, net of what it took back out.
 * Positive = they are out this much because of it; negative = it gave them more back than
 * it cost. Deleting the receipt moves their balance by exactly the opposite of it.
 */
export function netPfandCents(expense: Expense): number {
  return pfandPaid(expense) - pfandReturned(expense)
}

/** True once a receipt carries a deposit in either direction. */
export function hasPfand(expense: Expense): boolean {
  return pfandPaid(expense) > 0 || pfandReturned(expense) > 0
}

function pfandPaid(expense: Expense): number {
  return expense.pfandPaidCents ?? 0
}

function pfandReturned(expense: Expense): number {
  return expense.pfandReturnedCents ?? 0
}

// --- The ledger --------------------------------------------------------------

/**
 * Where one line of the ledger came from. Three kinds rather than a sign and a source flag,
 * because each reads as a different sentence on screen.
 */
export type PfandTxnKind =
  | 'receipt_paid' // a deposit charged on a receipt
  | 'receipt_returned' // a deposit refunded on the same receipt
  | 'refund' // packaging taken back to the shop for cash, buying nothing

/** One line of the ledger: money in or out of one person's own pocket. */
export type PfandTxn = {
  /**
   * Unique across the ledger. Not the row id: a receipt carrying a deposit in both
   * directions yields two lines, so the row id alone would collide and React would draw
   * one of every pair.
   */
  id: string
  kind: PfandTxnKind
  /** The row this was derived from — a receipt or an entry — for editing and deleting. */
  rowId: string
  date: string
  createdAt: number
  /** Whose pocket, as typed. */
  payer: string
  /** Positive = money left this pocket. Negative = it came back. */
  deltaCents: number
  /** The receipt's item. Absent on a refund, which is about nothing but the money. */
  subject?: string
  /**
   * Who actually stood at the till, when that is not whose pocket the line lands in. Set
   * only on a receipt somebody else paid and has since been paid back for: the deposit is
   * the money holder's from then on, and this is what says where it came from.
   */
  via?: string
  note?: string
}

/**
 * True for lines derived from a receipt. They are read-only on the pfand screen — the
 * deposit is one field of a row that also spent money, so it is changed on the receipt —
 * and this is also what decides whether a ledger row gets an actions menu at all.
 */
export function isReceiptTxn(kind: PfandTxnKind): boolean {
  return kind === 'receipt_paid' || kind === 'receipt_returned'
}

/**
 * Whose pocket a receipt's deposit sits in *now*, as typed.
 *
 * The person who stood at the till, until the money holder pays them back: settling up
 * covers the deposit as well as the goods, so from that tick onwards the claim is the
 * holder's to reclaim and the books read as though the holder had done it themselves.
 *
 * Derived from `reimbursed` rather than written down when the tick happens, which is what
 * makes every later edit of the receipt — its amounts, its payer, its deletion — land on
 * the right balance with nothing to keep in step.
 */
export function pfandOwner(expense: Expense, moneyHolder: string | undefined): string {
  const payer = expense.paidBy?.trim() ?? ''
  if (expense.reimbursed !== true || moneyHolder === undefined) return payer
  return isSamePayer(payer, moneyHolder) ? payer : moneyHolder.trim()
}

/**
 * Every movement of deposit money in the camp, newest first — receipts and hand-entered
 * rows in one list, because a balance is only true if it counts both.
 */
export function pfandLedger(
  expenses: Expense[],
  entries: PfandEntry[],
  moneyHolder?: string,
): PfandTxn[] {
  const txns: PfandTxn[] = []

  for (const expense of expenses) {
    const paidBy = expense.paidBy?.trim()
    // A receipt that does not say whose money it was names no pocket to charge the deposit
    // to. Only reachable for rows written before "paid by" was compulsory — and those carry
    // no pfand either — so skipping beats inventing an owner.
    if (paidBy === undefined || payerKey(paidBy) === '') continue

    // Once the receipt is paid back the deposit is the holder's, so the lines move pocket
    // with it. Both lines of a receipt move together — they are one till visit.
    const owner = pfandOwner(expense, moneyHolder)
    const common = {
      rowId: expense.id,
      date: expense.date,
      createdAt: expense.createdAt,
      payer: owner,
      subject: expense.name,
      via: isSamePayer(owner, paidBy) ? undefined : paidBy,
    }
    const paid = pfandPaid(expense)
    const returned = pfandReturned(expense)
    if (paid > 0) {
      txns.push({ ...common, id: `${expense.id}:paid`, kind: 'receipt_paid', deltaCents: paid })
    }
    if (returned > 0) {
      txns.push({
        ...common,
        id: `${expense.id}:returned`,
        kind: 'receipt_returned',
        deltaCents: -returned,
      })
    }
  }

  // A refund is money coming back into the pocket. The stored amount is always positive;
  // the direction is the kind's business.
  for (const entry of entries) {
    txns.push({
      id: entry.id,
      rowId: entry.id,
      kind: entry.kind,
      date: entry.date,
      createdAt: entry.createdAt,
      note: entry.note,
      payer: entry.payer,
      deltaCents: -entry.amountCents,
    })
  }

  return sortPfandTxns(txns)
}

/** Newest first, ties broken on creation order and then on the id, so both phones draw
 *  the list in the same order. */
export function sortPfandTxns(txns: PfandTxn[]): PfandTxn[] {
  return txns.toSorted(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt || a.id.localeCompare(b.id),
  )
}

/** What one person is out of pocket. Negative when more came back than went out. */
export type PfandBalance = {
  /** As typed, in the spelling the newest line used. */
  name: string
  outstandingCents: number
  txnCount: number
}

/**
 * One row per pocket, biggest debt first. Everyone the ledger names is listed, a settled
 * balance included: "Anna is square" is the answer somebody came to this screen for, and
 * dropping the row would leave them wondering whether it was ever recorded.
 */
export function pfandBalances(txns: PfandTxn[]): PfandBalance[] {
  // Keyed by the normalised name, so a stray capital adds a spelling rather than a person.
  const byKey = new Map<string, PfandBalance>()

  // Newest first already, so the first spelling seen for a key is the newest one — the way
  // you last wrote it, not the way you wrote it in July.
  for (const txn of sortPfandTxns(txns)) {
    const key = payerKey(txn.payer)
    if (key === '') continue
    const seen = byKey.get(key)
    if (seen === undefined) {
      byKey.set(key, { name: txn.payer.trim(), outstandingCents: txn.deltaCents, txnCount: 1 })
      continue
    }
    seen.outstandingCents += txn.deltaCents
    seen.txnCount += 1
  }

  return [...byKey.values()].toSorted(
    (a, b) => b.outstandingCents - a.outstandingCents || a.name.localeCompare(b.name),
  )
}

/** One person's balance, or 0 when the ledger has never named them. */
export function pfandBalanceCents(balances: PfandBalance[], name: string | undefined): number {
  if (name === undefined) return 0
  const key = payerKey(name)
  return balances.find((balance) => payerKey(balance.name) === key)?.outstandingCents ?? 0
}

// --- The row guard -----------------------------------------------------------

/** The door from an unknown database row into the typed world. */
export function isPfandEntry(value: unknown): value is PfandEntry {
  if (typeof value !== 'object' || value === null) return false
  const e = value as Record<string, unknown>
  if (
    typeof e.id !== 'string' ||
    typeof e.campId !== 'string' ||
    typeof e.payer !== 'string' ||
    typeof e.amountCents !== 'number' ||
    typeof e.date !== 'string' ||
    (e.note !== undefined && typeof e.note !== 'string') ||
    typeof e.createdAt !== 'number'
  ) {
    return false
  }
  // A refund is the only kind there is. Anything else is a row from the build that stored
  // handovers, and the ledger now derives those from the receipt instead — letting one
  // through would count the same transfer twice.
  return e.kind === 'refund'
}

// --- The entry form ----------------------------------------------------------

/**
 * The form's editable shape: everything a string, euros still euros.
 *
 * No `kind`: a refund is the only pfand row anybody stores. A deposit changing owner is
 * derived from the receipt that was paid back, so the money and the deposit it carries
 * stay one act with one undo — a form that could mint a transfer on its own would be a
 * second way to say the same thing, and the two would drift apart the moment a receipt
 * was edited.
 */
export type PfandDraft = {
  /** Whose pocket this is about, as typed. */
  payer: string
  amount: string // euros as typed
  date: string // ISO "YYYY-MM-DD"
  note: string
}

/** What is wrong with the draft, as codes — `src/lib/` never decides how the UI reads. */
export type PfandIssue = 'payer' | 'amount' | 'date'

/** What the hook needs to write a row. Ids and timestamps are minted in `src/db/`. */
export type PfandEntryFields = {
  campId: string
  payer: string
  amountCents: number
  date: string
  note?: string
}

export type SavePfandInput = {
  /** The row being edited, or null when adding. Carries id + createdAt forward. */
  existing: PfandEntry | null
  fields: PfandEntryFields
}

/**
 * A fresh draft. Everything the screen already knows is passed in: the person the row is
 * about, and their current balance as the amount — a refund is nearly always "all of it",
 * and the field stays editable for the partial case.
 */
export function blankPfandDraft(todayIso: string, payer: string, amountCents: number): PfandDraft {
  return {
    payer,
    amount: amountCents > 0 ? typedEuros(amountCents) : '',
    date: todayIso,
    note: '',
  }
}

/** Seed the editor from a persisted row. */
export function draftFromPfandEntry(entry: PfandEntry): PfandDraft {
  return {
    payer: entry.payer,
    amount: typedEuros(entry.amountCents),
    date: entry.date,
    note: entry.note ?? '',
  }
}

/** Problems with the draft. Empty array = Save is allowed. */
export function pfandIssues(draft: PfandDraft): PfandIssue[] {
  const issues: PfandIssue[] = []

  if (draft.payer.trim() === '') issues.push('payer')

  const cents = parseEurosToCents(draft.amount)
  if (cents === null || cents <= 0) issues.push('amount')

  if (draft.date === '') issues.push('date')

  return issues
}

/** The draft as a write payload, or null while `pfandIssues` is non-empty. */
export function pfandDraftToInput(
  draft: PfandDraft,
  campId: string,
  existing: PfandEntry | null,
): SavePfandInput | null {
  // One gate, so a caller cannot smuggle an invalid draft past validation by calling this
  // instead of checking the issues first.
  if (pfandIssues(draft).length > 0) return null

  const amountCents = parseEurosToCents(draft.amount)
  if (amountCents === null) return null // unreachable after the gate; keeps the type honest

  const note = draft.note.trim()

  return {
    existing,
    fields: {
      campId,
      payer: draft.payer.trim(),
      amountCents,
      date: draft.date,
      note: note === '' ? undefined : note, // an omitted optional field is undefined, not ''
    },
  }
}

/**
 * Cents as the form spells euros: "1234,56". Not `formatEuros` — its currency sign is
 * something the parser would reject on the way back in.
 */
export function typedEuros(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}
