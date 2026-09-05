/**
 * The end-of-camp financial report, as three tables: what came in, what went out, and the
 * difference between them.
 *
 * The arithmetic is deliberately exact — Σ income − Σ expenses equals the difference table
 * to the cent, overspending included. That is what makes the three tables readable as one
 * statement. It is *not* the same question as "how much do we transfer back", which floors
 * each pool separately and lives in `settlement.ts`; the report shows both, the difference
 * table here and the warnings from there.
 *
 * Pure — no React, no storage, no strings a user reads. All amounts are integer cents.
 */

import { spentTotalCents } from './budget'
import { otherExpensesTotalCents, sortOtherExpensesOldestFirst } from './otherExpenses'
import { type PoolSummary, sourceAmountCents } from './pools'
import type {
  Expense,
  FeeMovement,
  IncomeSource,
  Movement,
  OtherExpense,
  PerDiemBlock,
  Pool,
} from './types'

/** One income, under the cash-advance heading it was granted through. */
export type AdvanceLine = {
  source: IncomeSource
  /** The pool it feeds — the label falls back to it when the income has no name of its own. */
  pool: Pool
  amountCents: number
}

/** The fees collected from participants, listed one payment at a time. */
export type FeeSection = {
  payments: FeeMovement[]
  totalCents: number
}

/** One pool's spending. `pool` is null for receipts whose pool was deleted — they are still
 *  money out, so they get a line rather than quietly falling out of the total. */
export type ExpenseLine = {
  pool: Pool | null
  spentCents: number
}

/**
 * Money no pool paid for, listed one row at a time rather than as a single total: each one
 * is a separate claim on the organisation, and a lump sum would say nothing about what was
 * bought.
 */
export type OtherExpenseSection = {
  /** Oldest first, so the section reads as the ledger it is. */
  items: OtherExpense[]
  totalCents: number
}

/**
 * Why the difference is what it is. Codes, not sentences — `src/lib/` never decides how the
 * UI reads. `pool_unspent` and `deposit_return` may be negative: a pool spent past its
 * funding took the difference down with it, and saying so is the point of the table.
 */
export type DifferenceKind =
  | 'pool_unspent'
  | 'pool_unusable'
  | 'deposit_return'
  | 'fee'
  | 'orphan_spent'
  | 'other_expenses'

export type DifferenceLine = {
  kind: DifferenceKind
  /** The pool the line is about; null for the fee and for orphaned receipts. */
  pool: Pool | null
  amountCents: number
}

export type FinancialReport = {
  advance: AdvanceLine[]
  advanceTotalCents: number
  /** Null when no fee was collected at all — then the section is left off the report. */
  fee: FeeSection | null
  incomeTotalCents: number
  expenses: ExpenseLine[]
  /** Null when there are none, or when the reader has switched them off. */
  other: OtherExpenseSection | null
  /** The pool spending plus `other`, so the table's foot is the figure the difference uses. */
  expenseTotalCents: number
  difference: DifferenceLine[]
  /**
   * income − expenses, exactly. Σ `difference` adds up to this. **Negative when out-of-pocket
   * spending outruns the income** — then it is not a rest at all but what the organisation
   * owes the money holder, which is the whole reason other expenses are on the report.
   */
  differenceCents: number
}

export type ReportInput = {
  /** Already summarised by the caller, so the report, the bars and the settlement cannot
   *  disagree about what a pool holds. */
  summaries: PoolSummary[]
  /** The whole camp's blocks: what prices a per-diem grant. */
  blocks: PerDiemBlock[]
  expenses: Expense[]
  movements: Movement[]
  /** The out-of-pocket rows. Always passed; `includeOther` decides whether they count. */
  otherExpenses: OtherExpense[]
  /**
   * Whether out-of-pocket spending is part of the arithmetic. A reader's switch, not a
   * property of the data: the same camp is read both ways — once as the camp's own books,
   * once with what the organisation still owes folded in.
   */
  includeOther: boolean
}

export function buildReport(input: ReportInput): FinancialReport {
  const { summaries, blocks, expenses, movements, otherExpenses, includeOther } = input
  const ordered = reportOrder(summaries)

  const advance = ordered.flatMap((summary) =>
    summary.sources.map((source) => ({
      source,
      pool: summary.pool,
      amountCents: sourceAmountCents(source, blocks),
    })),
  )
  const advanceTotalCents = sum(advance.map((line) => line.amountCents))

  const payments = movements
    .filter(isFeeMovement)
    // Oldest first: the section reads as the ledger it is.
    .toSorted((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
  const fee =
    payments.length === 0
      ? null
      : { payments, totalCents: sum(payments.map((payment) => payment.amountCents)) }

  const orphanSpentCents = orphanedSpendCents(summaries, expenses)
  const expenseLines: ExpenseLine[] = [
    ...ordered
      // A Kaution is not spending: it only reaches this table when part of it was kept for
      // damage, and an untouched deposit has no business on a list of expenses.
      .filter((summary) => summary.pool.role !== 'deposit' || summary.spentCents !== 0)
      .map((summary) => ({ pool: summary.pool, spentCents: summary.spentCents })),
    ...(orphanSpentCents > 0 ? [{ pool: null, spentCents: orphanSpentCents }] : []),
  ]

  // Switched off, or none typed, and the section is left off entirely — an empty heading on
  // a report reads as a number somebody forgot to fill in.
  const other =
    !includeOther || otherExpenses.length === 0
      ? null
      : {
          items: sortOtherExpensesOldestFirst(otherExpenses),
          totalCents: otherExpensesTotalCents(otherExpenses),
        }

  const incomeTotalCents = advanceTotalCents + (fee?.totalCents ?? 0)
  // From the receipts rather than the pool sums, so this total always matches the one on the
  // receipts screen — including receipts whose pool has since been deleted. Out-of-pocket
  // money is added on top: it bought something for the camp, whoever's wallet it came from.
  const expenseTotalCents = spentTotalCents(expenses) + (other?.totalCents ?? 0)

  return {
    advance,
    advanceTotalCents,
    fee,
    incomeTotalCents,
    expenses: expenseLines,
    other,
    expenseTotalCents,
    difference: differenceLines(
      ordered,
      fee?.totalCents ?? 0,
      orphanSpentCents,
      other?.totalCents ?? 0,
    ),
    differenceCents: incomeTotalCents - expenseTotalCents,
  }
}

/**
 * Every way the difference is made up, one line each. Zero lines are dropped — a table
 * explaining a total gains nothing from rows worth nothing — and negative ones are kept,
 * because a pool that overspent is exactly why the total is smaller than expected.
 */
function differenceLines(
  ordered: PoolSummary[],
  feeTotalCents: number,
  orphanSpentCents: number,
  otherTotalCents: number,
): DifferenceLine[] {
  const lines: DifferenceLine[] = []
  const add = (kind: DifferenceKind, pool: Pool | null, amountCents: number) => {
    if (amountCents !== 0) lines.push({ kind, pool, amountCents })
  }

  for (const summary of ordered) {
    if (summary.pool.role === 'deposit') {
      // A Kaution's difference is what comes back: the deposit minus what the counterparty
      // kept for damage. That is the pool's only spending, so it is `spentCents` — where the
      // Kaution currently sits is a custody question, not a report one.
      add('deposit_return', summary.pool, summary.fundedCents - summary.spentCents)
      continue
    }

    // Unspent and never-ours-to-spend are separate lines: "we underspent" and "this was
    // never ours" are different sentences to the organisation getting the money back. The
    // two together are the pool's funded − spent.
    add('pool_unspent', summary.pool, summary.remainingCents)
    add('pool_unusable', summary.pool, summary.unusableCents)
  }

  add('fee', null, feeTotalCents)
  // Money out with no pool left to book it against — negative, like every other outflow.
  add('orphan_spent', null, -orphanSpentCents)
  // The one line that can take the total below zero: nobody's pool funded this, so it comes
  // straight off the rest, and past zero it is what the organisation owes back.
  add('other_expenses', null, -otherTotalCents)

  return lines
}

/** Receipts pointing at a pool that no longer exists. Still spent money, so still counted. */
function orphanedSpendCents(summaries: PoolSummary[], expenses: Expense[]): number {
  const known = new Set(summaries.map((s) => s.pool.id))
  return sum(expenses.filter((e) => !known.has(e.poolId)).map((e) => e.amountCents))
}

function isFeeMovement(movement: Movement): movement is FeeMovement {
  return movement.kind === 'volunteer_in'
}

function sum(amounts: number[]): number {
  return amounts.reduce((total, amount) => total + amount, 0)
}

/**
 * The reading order of the report: the daily pot, then the earmarked grants, then the
 * deposits — money you spend before money that is only passing through. Sorted explicitly
 * rather than trusting the query's order, and shared by the income and expense tables so
 * the two line up row for row.
 */
function reportOrder(summaries: PoolSummary[]): PoolSummary[] {
  const rank = { everyday: 0, earmarked: 1, deposit: 2 }
  return summaries.toSorted((a, b) => rank[a.pool.role] - rank[b.pool.role])
}
