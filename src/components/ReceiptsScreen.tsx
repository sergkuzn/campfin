import { useMemo, useState } from 'react'
import './ReceiptsScreen.css'
import type { UseExpenses } from '../hooks/useExpenses'
import { useFormat, useT } from '../i18n'
import { spentTotalCents } from '../lib/budget'
import { todayIso } from '../lib/dates'
import {
  arrangeExpenses,
  type ExpenseSort,
  filterExpensesByPools,
  nextReceiptNumber,
  type SaveExpenseInput,
  takenReceiptNumbers,
} from '../lib/expenses'
import { type PoolSummary, spendablePools } from '../lib/pools'
import { ConfirmDialog } from './ConfirmDialog'
import { ExpenseDayList } from './ExpenseDayList'
import { ExpenseForm } from './ExpenseForm'
import { ReceiptFilters } from './ReceiptFilters'

type Props = {
  campId: string
  expenses: UseExpenses
  /** This camp's pools — every one of them, so a row can still be named after its pool.
   *  Spending and deposits are separate blocks on the dashboard and stay separate here:
   *  only the spendable ones are offered to the picker and the filter. */
  summaries: PoolSummary[]
  /** The pool the screen opens filtered to, or null for the whole list. Read once, when the
   *  screen mounts — from then on the chips are the user's. */
  focusPoolId: string | null
  onBack: () => void
}

/** Which receipt is unlocked. One at a time — the same lock model as the income screen. */
type Editing = { mode: 'new' } | { mode: 'edit'; expenseId: string }

export function ReceiptsScreen({ campId, expenses, summaries, focusPoolId, onBack }: Props) {
  const t = useT()
  const format = useFormat()

  const [editing, setEditing] = useState<Editing | null>(null)
  // Ids only: the confirm question derives its numbers at render time, so it can never
  // quote a stale amount.
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [sort, setSort] = useState<ExpenseSort>('date_desc')
  // Which pools the list is limited to. An empty set means no filter at all, so switching
  // the last chip off returns to the whole list. The initialiser runs on the first render
  // only, which is what makes the pool tapped on the dashboard a starting point rather than
  // a lock the chips below cannot undo.
  const [poolFilter, setPoolFilter] = useState<ReadonlySet<string>>(() =>
    focusPoolId === null ? new Set() : new Set([focusPoolId]),
  )

  const rows = expenses.expenses
  // A receipt consumes budget, and a deposit is somebody else's money held in trust — it is
  // accounted for on the deposits screen, so its pool is not on offer here.
  const spendable = spendablePools(summaries)
  const editingRow =
    editing?.mode === 'edit' ? (rows.find((e) => e.id === editing.expenseId) ?? null) : null
  // `find` gives undefined once the row is gone — deleted here or by the other leader
  // mid-sync — and the dialog simply closes rather than quoting a row that no longer exists.
  const pending = pendingId === null ? undefined : rows.find((e) => e.id === pendingId)
  // A row can vanish under an open form — the other leader deleted it mid-sync. Nothing is
  // unlocked then, so the rest of the screen must not stay inert with no form to cancel.
  const locked = editing?.mode === 'new' || editingRow !== null

  // Filtering and sorting are pure functions of the rows and the two settings, so they are
  // memoised together: without it every keystroke in the open form would re-sort the list.
  const shown = useMemo(() => filterExpensesByPools(rows, poolFilter), [rows, poolFilter])
  const view = useMemo(() => arrangeExpenses(shown, sort), [shown, sort])

  // Uniqueness is checked against the *whole* camp, never the filtered view: a number
  // hidden by a filter is still taken.
  const takenNumbers = takenReceiptNumbers(rows, editingRow?.id ?? null)
  const suggestedNumber = nextReceiptNumber(rows)

  const handleSave = (input: SaveExpenseInput) => {
    expenses.saveExpense(input)
    setEditing(null)
  }

  const handleConfirmDelete = () => {
    if (pendingId !== null) expenses.deleteExpense(pendingId)
    setPendingId(null)
  }

  const togglePool = (poolId: string) => {
    setPoolFilter((current) => {
      // A new Set every time: mutating the old one would leave the reference unchanged and
      // React would not re-render.
      const next = new Set(current)
      if (!next.delete(poolId)) next.add(poolId)
      return next
    })
  }

  const pendingPoolName =
    summaries.find((s) => s.pool.id === pending?.poolId)?.pool.name ?? t.receipts.unknownPool

  const filtering = shown.length !== rows.length

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
          disabled={locked || spendable.length === 0}
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
          pools={spendable}
          // Read at the edge and passed down, so nothing below here touches the clock.
          todayIso={todayIso()}
          takenNumbers={takenNumbers}
          suggestedNumber={suggestedNumber}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {/* Sorting an empty list is a control with nothing to act on, so the bar appears
          only once there are receipts. */}
      {rows.length > 0 && (
        <ReceiptFilters
          pools={spendable.map((s) => s.pool)}
          sort={sort}
          onSortChange={setSort}
          selected={poolFilter}
          onToggle={togglePool}
          onClear={() => setPoolFilter(new Set())}
        />
      )}

      {/* "Nothing here yet" would be a lie for the first second, so the loading line wins
          while the query is still out. */}
      {rows.length === 0 && !locked && (
        <p className="income__empty">{expenses.isLoading ? t.app.loading : t.receipts.empty}</p>
      )}

      {/* An empty *filtered* list is a different message: there are receipts, just none in
          the pools that are switched on. */}
      {rows.length > 0 && shown.length === 0 && (
        <p className="income__empty">{t.receipts.emptyFiltered}</p>
      )}

      <ExpenseDayList
        view={view}
        pools={summaries.map((s) => s.pool)}
        editingId={editingRow?.id ?? null}
        locked={locked}
        onEdit={(expenseId) => setEditing({ mode: 'edit', expenseId })}
        onDelete={(expenseId) => setPendingId(expenseId)}
        // Called only for the edited row. Switching rows moves the form to a different
        // <li>, which remounts it, so the draft re-seeds without a `key` of its own.
        renderForm={() => (
          <ExpenseForm
            campId={campId}
            expense={editingRow}
            pools={spendable}
            todayIso={todayIso()}
            takenNumbers={takenNumbers}
            suggestedNumber={suggestedNumber}
            onSave={handleSave}
            onCancel={() => setEditing(null)}
          />
        )}
      />

      <footer className="income__totals">
        {/* The totals count what is on screen, so a filtered list and its sum always agree;
            the line below says how many rows that is out of the camp's receipts. */}
        <p className="income__total-row">
          <span>{t.receipts.spentTotal}</span>
          <strong>{format.euros(spentTotalCents(shown))}</strong>
        </p>
        <p className="income__total-row">
          <span>
            {filtering
              ? t.receipts.filterCount(shown.length, rows.length)
              : t.receipts.count(rows.length)}
          </span>
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
