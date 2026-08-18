import { useFormat, useT } from '../i18n'
import type { ExpenseView } from '../lib/expenses'
import type { Expense, Pool } from '../lib/types'
import { PoolTag } from './PoolTag'
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
  onEdit: (expenseId: string) => void
  onDelete: (expenseId: string) => void
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
  onEdit,
  onDelete,
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
        onEdit={() => onEdit(expense.id)}
        onDelete={() => onDelete(expense.id)}
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
  onEdit: () => void
  onDelete: () => void
}

function ReceiptRow({ expense, pool, locked, onEdit, onDelete }: RowProps) {
  const t = useT()
  const format = useFormat()

  return (
    <li className="receipt">
      <div className="receipt__main">
        <span className="receipt__title">
          {/* Ahead of the name, because a numbered list is read down its numbers — that is
              how a row here gets matched to a slip in the folder. */}
          {expense.number !== undefined && (
            <span className="receipt__number">{t.receipts.numberTag(expense.number)}</span>
          )}
          <span className="receipt__name">{expense.name}</span>
        </span>

        {pool === undefined ? (
          <span className="receipt__pool">{t.receipts.unknownPool}</span>
        ) : (
          <PoolTag pool={pool} />
        )}

        {expense.note !== undefined && <span className="receipt__note">{expense.note}</span>}
      </div>

      <span className="receipt__amount">{format.euros(expense.amountCents)}</span>

      <RowMenu label={expense.name} disabled={locked} onEdit={onEdit} onDelete={onDelete} />
    </li>
  )
}
