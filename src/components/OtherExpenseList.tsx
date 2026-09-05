import { useFormat, useT } from '../i18n'
import { sortOtherExpensesNewestFirst } from '../lib/otherExpenses'
import type { OtherExpense } from '../lib/types'
import { PayerLine } from './PayerLine'
import { RowMenu } from './RowMenu'

type Props = {
  expenses: OtherExpense[]
  /** The row that is unlocked, if any — it shows the form in place of the row. */
  editingId: string | null
  /** True while a form is open: every row's actions go inert, the same lock model as the
   *  receipts and movements screens. */
  locked: boolean
  /** The leader holding the cash. Undefined until one is named, and then no row can owe. */
  moneyHolder: string | undefined
  onEdit: (expenseId: string) => void
  onDelete: (expenseId: string) => void
  /** Tick a row off as taken over by the money holder, or un-tick it. */
  onToggleRepaid: (expenseId: string, repaid: boolean) => void
  /** A render prop: the screen owns the form and its props, this list owns only where the
   *  form appears — in the edited row's slot, so nothing above it moves. */
  renderForm: () => React.ReactNode
}

/**
 * Flat, newest first. Not grouped by day like the receipts: a camp collects a handful of
 * these in total, and grouping three rows under three headings only adds noise.
 */
export function OtherExpenseList({
  expenses,
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

  return (
    <ul className="other-expenses__rows">
      {sortOtherExpensesNewestFirst(expenses).map((expense) =>
        expense.id === editingId ? (
          // No `other-expense` class: the form brings its own card frame, and the row's
          // border around it would read as a box inside a box.
          <li key={expense.id}>{renderForm()}</li>
        ) : (
          <li className="other-expense" key={expense.id}>
            <div className="other-expense__main">
              <span className="other-expense__name">{expense.name}</span>
              <span className="other-expense__meta">{format.day(expense.date)}</span>

              {/* Renders nothing when the money holder paid it themselves — then there is
                  nobody for them to settle with, only the organisation. */}
              <PayerLine
                row={expense}
                moneyHolder={moneyHolder}
                locked={locked}
                onToggleRepaid={(repaid) => onToggleRepaid(expense.id, repaid)}
              />

              {expense.note !== undefined && (
                <span className="other-expense__note">{expense.note}</span>
              )}
            </div>

            <span className="other-expense__amount">{format.euros(expense.amountCents)}</span>

            <RowMenu
              label={expense.name}
              disabled={locked}
              items={[
                { label: t.rowMenu.edit, onSelect: () => onEdit(expense.id) },
                { label: t.rowMenu.delete, danger: true, onSelect: () => onDelete(expense.id) },
              ]}
            />
          </li>
        ),
      )}
    </ul>
  )
}
