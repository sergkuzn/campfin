// The card's edge is painted with the palette classes, so the stylesheet that defines them
// has to be loaded even though no PoolTag is rendered here.
import './PoolTag.css'
import { type Dict, useFormat, useT } from '../i18n'
import type { ExpenseView } from '../lib/expenseViews'
import { hasPfand, receiptTotalCents } from '../lib/pfand'
import { poolColorOf } from '../lib/poolColors'
import type { Expense, Pool } from '../lib/types'
import { PayerLine } from './PayerLine'
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

        {/* Renders nothing when the receipt came out of the camp cash, which is nearly all
            of them — spelling that out on every row would cost a line to repeat what the
            reader already knows, the same reasoning that put the pool on the card's edge. */}
        <PayerLine
          row={expense}
          moneyHolder={moneyHolder}
          locked={locked}
          onToggleRepaid={onToggleRepaid}
        />

        {expense.note !== undefined && <span className="receipt__note">{expense.note}</span>}
      </div>

      {/* The headline amount is the group's money, so a receipt with a deposit on it prints
          the slip's own total underneath — otherwise the row and the folder disagree and
          neither explains why. Both sit in the amount column so the three figures stack
          right-aligned instead of splitting across the row. */}
      <span className="receipt__figures">
        <span className="receipt__amount">{format.euros(expense.amountCents)}</span>
        {hasPfand(expense) && (
          <>
            <span className="receipt__pfand">
              {pfandText(expense, t.receipts.pfand, format.euros)}
            </span>
            <span className="receipt__pfand">
              {t.receipts.pfand.rowTotal(format.euros(receiptTotalCents(expense)))}
            </span>
          </>
        )}
      </span>

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
