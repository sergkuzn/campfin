import { useFormat, useT } from '../i18n'
import { groupExpensesByDay } from '../lib/expenses'
import type { Expense, Pool } from '../lib/types'

type Props = {
  expenses: Expense[]
  /** For naming the pool a row was paid from. */
  pools: Pool[]
  /** True while a form is open: every row's actions go inert, exactly as on the income
   *  screen — one thing being edited at a time is the whole lock model. */
  locked: boolean
  onEdit: (expenseId: string) => void
  onDelete: (expenseId: string) => void
}

/** The quittung list, grouped by day with a per-day total, newest day first. */
export function ExpenseDayList({ expenses, pools, locked, onEdit, onDelete }: Props) {
  const t = useT()
  const format = useFormat()

  // A Map turns "which pool is this?" into one lookup per row instead of a scan per row.
  const poolNames = new Map(pools.map((pool) => [pool.id, pool.name]))
  const days = groupExpensesByDay(expenses)

  return (
    <div className="quittungs__days">
      {days.map((day) => (
        <section className="day" key={day.date}>
          <header className="day__header">
            <h3 className="day__date">{format.day(day.date)}</h3>
            <span className="day__total">{t.quittungs.dayTotal(format.euros(day.totalCents))}</span>
          </header>

          <ul className="day__rows">
            {day.expenses.map((expense) => (
              <li className="quittung" key={expense.id}>
                <div className="quittung__main">
                  <span className="quittung__name">{expense.name}</span>
                  <span className="quittung__pool">
                    {poolNames.get(expense.poolId) ?? t.quittungs.unknownPool}
                  </span>
                  {expense.note !== undefined && (
                    <span className="quittung__note">{expense.note}</span>
                  )}
                </div>

                <span className="quittung__amount">{format.euros(expense.amountCents)}</span>

                <div className="quittung__actions">
                  <button
                    className="quittung__action"
                    type="button"
                    disabled={locked}
                    aria-label={t.quittungs.editAction(expense.name)}
                    onClick={() => onEdit(expense.id)}
                  >
                    {t.quittungs.edit}
                  </button>
                  <button
                    className="quittung__action quittung__action--danger"
                    type="button"
                    disabled={locked}
                    aria-label={t.quittungs.deleteAction(expense.name)}
                    onClick={() => onDelete(expense.id)}
                  >
                    {t.quittungs.delete}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
