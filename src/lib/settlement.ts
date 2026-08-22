/**
 * End-of-camp settlement: what was received, what was spent, and what goes back — as a
 * breakdown that *explains* the total rather than stating it.
 *
 * Two kinds of line come out of here. **Rows** are money leaving your hands: a pool's
 * leftover, per-diem money for people who never came, a Kaution coming back, the
 * participation fees. **Warnings** are the opposite — situations where a number on the sheet
 * is not yet the final word (a deposit still at a shop, an overspent pool, more people than
 * were funded). They are rows in the table, not footnotes, because a leader reading the
 * sheet at the end of camp reads it once.
 *
 * Composes `pools.ts` and `movements.ts`; kept separate so both stay flat toolboxes.
 */

import { perDiemTotals, spentTotalCents } from './budget'
import { custodyReading } from './movements'
import { payerDebts } from './payers'
import { type PoolSummary, receivedTotalCents, spendablePools } from './pools'
import type { Expense, Movement, PerDiemBlock, Pool } from './types'

/**
 * What one row of the breakdown is about. A *code*, not a sentence: `src/lib/` never
 * decides how the UI reads, so the dictionary turns each of these into a label.
 */
export type SettlementRowKind = 'pool_unspent' | 'pool_unusable' | 'deposit_return' | 'fee'

/** Something that is not wrong yet, but is not settled either. Also codes. */
export type SettlementWarningKind =
  | 'deposit_at_vendor'
  | 'pool_overspent'
  | 'over_attended'
  | 'owed_to_payer'

export type SettlementRow = {
  kind: SettlementRowKind
  /** The pool this money sits in; null only for the fee, which belongs to none. */
  pool: Pool | null
  /** Always positive — a row that would be zero or negative is not emitted at all. */
  amountCents: number
}

/**
 * A *discriminated union* rather than one shape with a nullable field for each kind: three
 * of these warnings are about a pool and the fourth is about a person, and a `pool: null`
 * plus a `payerName?: string` would let the compiler wave through a pool warning with a
 * name on it. Narrowing on `kind` hands each branch exactly the fields it has.
 */
export type SettlementWarning =
  | {
      kind: 'deposit_at_vendor' | 'pool_overspent' | 'over_attended'
      pool: Pool | null
      /** The size of the problem: still out, overspent by, over-attended by. */
      amountCents: number
    }
  | {
      /** The money holder has not paid somebody back yet. */
      kind: 'owed_to_payer'
      /** Who is owed, as the newest receipt spells it. */
      payerName: string
      amountCents: number
    }

export type Settlement = {
  receivedTotalCents: number
  spentTotalCents: number
  /** Σ `rows`. Deposits and the fee included — everything that leaves your hands. */
  toReturnCents: number
  rows: SettlementRow[]
  warnings: SettlementWarning[]
  /** The per-pool detail the rows were derived from, for callers that want the raw numbers. */
  pools: PoolSummary[]
}

export type SettlementInput = {
  /** Already summarised by the caller: one computation feeds the bars, the sheet and the
   *  CSV, so three screens cannot disagree about what a pool holds. */
  summaries: PoolSummary[]
  blocks: PerDiemBlock[]
  expenses: Expense[]
  movements: Movement[]
  /** The leader holding the cash, so what they still owe co-leaders can be flagged.
   *  Absent means nobody holds it, and then no receipt owes anybody anything. */
  moneyHolder?: string
}

export function computeSettlement(input: SettlementInput): Settlement {
  const { summaries, blocks, expenses, movements, moneyHolder } = input
  const custody = custodyReading(summaries, movements)

  const rows: SettlementRow[] = []
  /** Zero rows are noise on a sheet whose job is to explain a total, so they are dropped. */
  const addRow = (kind: SettlementRowKind, pool: Pool | null, amountCents: number) => {
    if (amountCents > 0) rows.push({ kind, pool, amountCents })
  }

  for (const summary of everydayFirst(spendablePools(summaries))) {
    // Floored per pool: overspending the bike pool must not eat the everyday leftover.
    addRow('pool_unspent', summary.pool, Math.max(0, summary.remainingCents))
    // Separate row, not folded into the leftover: "we underspent" and "this was never ours
    // to spend" are different sentences to the organisation that gets the money back.
    addRow('pool_unusable', summary.pool, summary.unusableCents)
  }

  // A deposit returns what it was worth minus what the counterparty kept for damage — the
  // forfeited part is already an expense on the pool, so `depositStatus` books it once.
  for (const status of custody.statuses) {
    addRow('deposit_return', status.pool, status.toReturnCents)
  }

  addRow('fee', null, custody.feeHeldCents)

  return {
    receivedTotalCents: receivedTotalCents(summaries),
    // From the expenses rather than the pool sums, so this total always matches the one on
    // the receipts screen, even if a receipt ever outlives the pool it was tagged to.
    spentTotalCents: spentTotalCents(expenses),
    toReturnCents: rows.reduce((sum, row) => sum + row.amountCents, 0),
    rows,
    warnings: [
      ...custody.statuses
        .filter((status) => status.atVendorCents > 0)
        .map((status) => warning('deposit_at_vendor', status.pool, status.atVendorCents)),
      ...summaries
        .filter((summary) => summary.remainingCents < 0)
        .map((summary) => warning('pool_overspent', summary.pool, -summary.remainingCents)),
      ...overAttendedWarnings(summaries, blocks),
      // Not money going back to the organisation — an IOU between the leaders. It belongs
      // on the sheet all the same: until it is settled, the cash box holds money that is
      // somebody else's, and the sheet is read once, at the end.
      ...payerDebts(expenses, moneyHolder).map(
        (debt): SettlementWarning => ({
          kind: 'owed_to_payer',
          payerName: debt.name,
          amountCents: debt.owedCents,
        }),
      ),
    ],
    pools: summaries,
  }
}

/** The pool-shaped warnings. The payer one is built inline, since it carries a name
 *  instead of a pool. */
function warning(
  kind: 'deposit_at_vendor' | 'pool_overspent' | 'over_attended',
  pool: Pool | null,
  amountCents: number,
): SettlementWarning {
  return { kind, pool, amountCents }
}

/**
 * More people came than the grant funded. Not an error and not extra budget — the money
 * that arrived is all there is — but it explains why the sheet returns less than expected.
 */
function overAttendedWarnings(
  summaries: PoolSummary[],
  blocks: PerDiemBlock[],
): SettlementWarning[] {
  return summaries.flatMap((summary) =>
    summary.sources
      .filter((source) => source.kind === 'per_diem')
      .map((source) => perDiemTotals(blocks, source.id).overAttendedCents)
      .filter((cents) => cents > 0)
      .map((cents) => warning('over_attended', summary.pool, cents)),
  )
}

/**
 * The daily pot leads the sheet — it is the pool a leader thinks in. The rest keep the
 * order they arrived in. Sorting explicitly rather than trusting creation order, because
 * that order comes from a query and is not part of any contract.
 */
function everydayFirst(summaries: PoolSummary[]): PoolSummary[] {
  return [
    ...summaries.filter((s) => s.pool.role === 'everyday'),
    ...summaries.filter((s) => s.pool.role !== 'everyday'),
  ]
}
