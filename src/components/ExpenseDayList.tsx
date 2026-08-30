// The card's edge is painted with the palette classes, so the stylesheet that defines them
// has to be loaded even though no PoolTag is rendered here.
import './PoolTag.css'
import { type Dict, useFormat, useT } from '../i18n'
import type { ExpenseView } from '../lib/expenseViews'
import { isSamePayer, owedPayerName } from '../lib/payers'
import { hasPfand, receiptTotalCents } from '../lib/pfand'
import { poolColorOf } from '../lib/poolColors'
import type { Expense, Pool } from '../lib/types'
import { RowMenu } from './RowMenu'

type Props = {
  /** The rows already sorted and grouped — the screen owns the sort setting, this list
   *  owns only how each shape is drawn. */
  view: ExpenseView
  /** For naming the pool a row was paid from, and colouring it. */
  pools: Pool[]
  /** The row that is unlocked, if any — it shows the form in place of the row. */
  editingId: string | null
  /** True while a form is open: every row's actions go inert, exactly as on the income
   *  screen — one thing being edited at a time is the whole lock model. */
  locked: boolean
  /** The leader holding the cash. Undefined until one is named, and then no row can owe. */
  moneyHolder: string | undefined
  onEdit: (expenseId: string) => void
  onDelete: (expenseId: string) => void
  /** Tick a receipt off as paid back, or un-tick it — straight from the row. */
  onToggleRepaid: (expenseId: string, repaid: boolean) => void
  /** A render prop: the screen owns the form and its props, this list owns only where the
   *  form appears — in the edited row's slot, so nothing above it moves. */
  renderForm: () => React.ReactNode
}

/** The receipt list: grouped by day with per-day totals, or one flat run in number order. */
export function ExpenseDayList({
  view,
  pools,
  editingId,
  locked,
  moneyHolder,
  onEdit,
  onDelete,
  onToggleRepaid,
  renderForm,
}: Props) {
  const t = useT()
  const format = useFormat()

  // A Map turns "which pool is this?" into one lookup per row instead of a scan per row.
  const poolsById = new Map(pools.map((pool) => [pool.id, pool]))

  const row = (expense: Expense) =>
    expense.id === editingId ? (
      // No `receipt` class: the form brings its own card frame, and the row's border
      // around it would read as a box inside a box.
      <li key={expense.id}>{renderForm()}</li>
    ) : (
      <ReceiptRow
        key={expense.id}
        expense={expense}
        pool={poolsById.get(expense.poolId)}
        locked={locked}
        moneyHolder={moneyHolder}
        onEdit={() => onEdit(expense.id)}
        onDelete={() => onDelete(expense.id)}
        onToggleRepaid={(repaid) => onToggleRepaid(expense.id, repaid)}
      />
    )

  if (view.mode === 'flat') {
    return (
      <div className="receipts__days">
        <ul className="day__rows">{view.expenses.map(row)}</ul>
      </div>
    )
  }

  return (
    <div className="receipts__days">
      {view.days.map((day) => (
        <section className="day" key={day.date}>
          <header className="day__header">
            <h3 className="day__date">{format.day(day.date)}</h3>
            <span className="day__total">{t.receipts.dayTotal(format.euros(day.totalCents))}</span>
          </header>

          <ul className="day__rows">{day.expenses.map(row)}</ul>
        </section>
      ))}
    </div>
  )
}

type RowProps = {
  expense: Expense
  /** Undefined when the pool is gone — deleted by the other leader mid-sync. */
  pool: Pool | undefined
  locked: boolean
  moneyHolder: string | undefined
  onEdit: () => void
  onDelete: () => void
  onToggleRepaid: (repaid: boolean) => void
}

/**
 * The deposit line, in whichever of the three shapes the receipt has: bought, returned, or
 * both. The signs are written out rather than left to `formatEuros`, so "+" and "−" line up
 * whichever direction the row is. The labels are passed in — a plain function, not a
 * component, so it must not reach for a hook of its own.
 */
function pfandText(
  expense: Expense,
  labels: Dict['receipts']['pfand'],
  euros: (cents: number) => string,
): string {
  const paid = expense.pfandPaidCents ?? 0
  const returned = expense.pfandReturnedCents ?? 0
  if (paid > 0 && returned > 0) return labels.rowBoth(euros(paid), euros(returned))
  if (paid > 0) return labels.rowPaid(euros(paid))
  return labels.rowReturned(euros(returned))
}

function ReceiptRow({
  expense,
  pool,
  locked,
  moneyHolder,
  onEdit,
  onDelete,
  onToggleRepaid,
}: RowProps) {
  const t = useT()
  const format = useFormat()

  // Both derived during render rather than stored: the row is a pure function of the
  // receipt and the camp's holder, so an optimistic write re-renders it with no state to
  // keep in step.
  //
  // `payerName` is who to *show* — anybody but the money holder. `owedTo` is the narrower
  // question of whether that money is still outstanding, and it is what the button's
  // direction hangs on.
  // Requires a holder: with nobody named there is no one for the money to be returned *by*,
  // so a Return button would be a control with nothing behind it.
  const payerName =
    moneyHolder !== undefined &&
    expense.paidBy !== undefined &&
    !isSamePayer(expense.paidBy, moneyHolder)
      ? expense.paidBy.trim()
      : null
  const owedTo = owedPayerName(expense, moneyHolder)

  return (
    // The pool is worn as a coloured left edge rather than a named pill on a line of its
    // own: nearly every receipt comes out of the everyday pot, so spelling that out cost a
    // line per row to repeat what the reader already knew. The hue class only carries the
    // palette's custom properties — the border in the stylesheet is what draws them.
    <li className={pool === undefined ? 'receipt' : `receipt pool-tag--${poolColorOf(pool)}`}>
      <div className="receipt__main">
        <span className="receipt__title">
          {/* Ahead of the name, because a numbered list is read down its numbers — that is
              how a row here gets matched to a slip in the folder. */}
          {expense.number !== undefined && (
            <span className="receipt__number">{t.receipts.numberTag(expense.number)}</span>
          )}
          <span className="receipt__name">{expense.name}</span>
          {/* Colour cannot be heard, so the pool is still named for a screen reader. It sits
              inside the title so the row is announced as one phrase. */}
          {pool !== undefined && <span className="visually-hidden">{pool.name}</span>}
        </span>

        {/* A pool deleted by the other leader mid-sync leaves no hue to colour the edge
            with, so this one case keeps words — silence would drop the fact entirely. */}
        {pool === undefined && <span className="receipt__pool">{t.receipts.unknownPool}</span>}

        {/* Only ever shown when someone other than the holder paid. Nearly every receipt
            comes out of the camp cash, and spelling that out on every row would cost a line
            to repeat what the reader already knows — the same reasoning that put the pool
            on the card's edge.

            The name is plain text and the action is a button beside it, rather than one
            coloured pill doing both jobs: a row you only want to read should not look like
            a row that wants tapping. */}
        {payerName !== null && (
          <span className="receipt__payer">
            <span className="receipt__payer-name">{t.receipts.payer.paidByRow(payerName)}</span>
            <button
              className={
                owedTo === null
                  ? 'receipt__return receipt__return--done'
                  : 'receipt__return receipt__return--owed'
              }
              type="button"
              disabled={locked}
              onClick={() => onToggleRepaid(owedTo !== null)}
            >
              {owedTo === null ? t.receipts.payer.returnedButton : t.receipts.payer.returnButton}
            </button>
          </span>
        )}

        {/* The headline amount is the group's money, so a receipt with a deposit on it says
            what the paper slip says too — otherwise the row and the folder disagree and
            neither explains why. */}
        {hasPfand(expense) && (
          <span className="receipt__pfand">
            {pfandText(expense, t.receipts.pfand, format.euros)} ·{' '}
            {t.receipts.pfand.rowTotal(format.euros(receiptTotalCents(expense)))}
          </span>
        )}

        {expense.note !== undefined && <span className="receipt__note">{expense.note}</span>}
      </div>

      <span className="receipt__amount">{format.euros(expense.amountCents)}</span>

      <RowMenu
        label={expense.name}
        disabled={locked}
        items={[
          { label: t.rowMenu.edit, onSelect: onEdit },
          { label: t.rowMenu.delete, danger: true, onSelect: onDelete },
        ]}
      />
    </li>
  )
}
