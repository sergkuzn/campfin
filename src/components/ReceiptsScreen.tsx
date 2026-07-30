import { useState } from 'react'
import './ReceiptsScreen.css'
import type { UseExpenses } from '../hooks/useExpenses'
import { useFormat, useT } from '../i18n'
import { spentTotalCents } from '../lib/budget'
import { todayIso } from '../lib/dates'
import type { SaveExpenseInput } from '../lib/expenses'
import type { PoolSummary } from '../lib/pools'
import { ConfirmDialog } from './ConfirmDialog'
import { ExpenseDayList } from './ExpenseDayList'
import { ExpenseForm } from './ExpenseForm'

type Props = {
  campId: string
  expenses: UseExpenses
  /** This camp's pools, for the picker and for naming a row's pool. */
  summaries: PoolSummary[]
  onBack: () => void
}

/** Which receipt is unlocked. One at a time — the same lock model as the income screen. */
type Editing = { mode: 'new' } | { mode: 'edit'; expenseId: string }

export function ReceiptsScreen({ campId, expenses, summaries, onBack }: Props) {
  const t = useT()
  const format = useFormat()

  const [editing, setEditing] = useState<Editing | null>(null)
  // Ids only: the confirm question derives its numbers at render time, so it can never
  // quote a stale amount.
  const [pendingId, setPendingId] = useState<string | null>(null)

  const rows = expenses.expenses
  const editingRow =
    editing?.mode === 'edit' ? (rows.find((e) => e.id === editing.expenseId) ?? null) : null
  // `find` gives undefined once the row is gone — deleted here or by the other leader
  // mid-sync — and the dialog simply closes rather than quoting a row that no longer exists.
  const pending = pendingId === null ? undefined : rows.find((e) => e.id === pendingId)

  const handleSave = (input: SaveExpenseInput) => {
    expenses.saveExpense(input)
    setEditing(null)
  }

  const handleConfirmDelete = () => {
    if (pendingId !== null) expenses.deleteExpense(pendingId)
    setPendingId(null)
  }

  const pendingPoolName =
    summaries.find((s) => s.pool.id === pending?.poolId)?.pool.name ?? t.receipts.unknownPool

  return (
    <div className="receipts">
      <button className="dashboard__back" type="button" onClick={onBack}>
        {t.receipts.back}
      </button>

      <header className="receipts__header">
        <h2 className="receipts__title">{t.receipts.title}</h2>
        <button
          className="income-form__button"
          type="button"
          disabled={editing !== null || summaries.length === 0}
          onClick={() => setEditing({ mode: 'new' })}
        >
          {t.receipts.add}
        </button>
      </header>

      {/* A write that only failed to *sync* says nothing — Instant queues it. This is for
          a write the server actually rejected. */}
      {expenses.error !== null && (
        <p className="income__error" role="alert">
          {expenses.error}
        </p>
      )}

      {editing?.mode === 'new' && (
        <ExpenseForm
          campId={campId}
          expense={null}
          pools={summaries}
          // Read at the edge and passed down, so nothing below here touches the clock.
          todayIso={todayIso()}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {editingRow !== null && (
        <ExpenseForm
          // Re-seed the draft when the user switches to a different row.
          key={editingRow.id}
          campId={campId}
          expense={editingRow}
          pools={summaries}
          todayIso={todayIso()}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {/* "Nothing here yet" would be a lie for the first second, so the loading line wins
          while the query is still out. */}
      {rows.length === 0 && editing === null && (
        <p className="income__empty">{expenses.isLoading ? t.app.loading : t.receipts.empty}</p>
      )}

      <ExpenseDayList
        expenses={rows}
        pools={summaries.map((s) => s.pool)}
        locked={editing !== null}
        onEdit={(expenseId) => setEditing({ mode: 'edit', expenseId })}
        onDelete={(expenseId) => setPendingId(expenseId)}
      />

      <footer className="income__totals">
        <p className="income__total-row">
          <span>{t.receipts.spentTotal}</span>
          <strong>{format.euros(spentTotalCents(rows))}</strong>
        </p>
        <p className="income__total-row">
          <span>{t.receipts.count(rows.length)}</span>
        </p>
      </footer>

      <ConfirmDialog
        open={pending !== undefined}
        title={pending === undefined ? '' : t.receipts.deleteTitle(pending.name)}
        lines={
          pending === undefined
            ? []
            : [t.receipts.deleteLine(format.euros(pending.amountCents), pendingPoolName)]
        }
        confirmLabel={t.receipts.confirmDelete}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingId(null)}
      />
    </div>
  )
}
