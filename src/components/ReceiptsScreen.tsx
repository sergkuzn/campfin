import { useMemo, useState } from 'react'
import './ReceiptsScreen.css'
import type { UseExpenses } from '../hooks/useExpenses'
import { useFormat, useT } from '../i18n'
import { spentTotalCents } from '../lib/budget'
import type { CampWindow } from '../lib/camps'
import { todayIso } from '../lib/dates'
import type { SaveExpenseInput } from '../lib/expenses'
import { arrangeExpenses, type ExpenseSort, filterExpensesByPools } from '../lib/expenseViews'
import { filterExpensesByDebt, isSamePayer, unreimbursedTotalCents } from '../lib/payers'
import { hasPfand, netPfandCents, pfandOwner } from '../lib/pfand'
import { type PoolSummary, spendablePools } from '../lib/pools'
import { nextReceiptNumber, takenReceiptNumbers } from '../lib/receiptNumbers'
import { ConfirmDialog } from './ConfirmDialog'
import { ExpenseDayList } from './ExpenseDayList'
import { ExpenseForm } from './ExpenseForm'
import { ReceiptFilters } from './ReceiptFilters'
import { Screen } from './Screen'
import { Toast } from './Toast'

type Props = {
  campId: string
  /** Who holds the camp cash. Every "owed" marker is measured against this name, and while
   *  it is absent nothing on the screen owes anybody anything. */
  moneyHolder: string | undefined
  /** The camp's known span, so the receipt date field can highlight it. `null` when the
   *  camp has no per-diem income yet. */
  campWindow: CampWindow | null
  expenses: UseExpenses
  /** This camp's pools — every one of them, so a row can still be named after its pool.
   *  Spending and deposits are separate blocks on the dashboard and stay separate here:
   *  only the spendable ones are offered to the picker and the filter. */
  summaries: PoolSummary[]
  /** The pool the screen opens filtered to, or null for the whole list. Read once, when the
   *  screen mounts — from then on the chips are the user's. */
  focusPoolId: string | null
  onBack: () => void
  /** Opens the pfand ledger. Deposits are entered on receipts here, so the ledger that
   *  nets them lives one step away rather than on the dashboard. */
  onOpenPfand: () => void
}

/** Which receipt is unlocked. One at a time — the same lock model as the income screen. */
type Editing = { mode: 'new' } | { mode: 'edit'; expenseId: string }

export function ReceiptsScreen({
  campId,
  moneyHolder,
  campWindow,
  expenses,
  summaries,
  focusPoolId,
  onBack,
  onOpenPfand,
}: Props) {
  const t = useT()
  const format = useFormat()

  const [editing, setEditing] = useState<Editing | null>(null)
  // Ids only: the confirm question derives its numbers at render time, so it can never
  // quote a stale amount.
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [sort, setSort] = useState<ExpenseSort>('date_desc')
  // Which pools the list is limited to. An empty set means no filter at all, so the whole
  // list is what both switching the last chip off and switching the last chip on land on.
  // The initialiser runs on the first render only, which is what makes the pool tapped on
  // the dashboard a starting point rather than a lock the chips below cannot undo.
  const [poolFilter, setPoolFilter] = useState<ReadonlySet<string>>(() =>
    focusPoolId === null ? new Set() : new Set([focusPoolId]),
  )
  // A second axis over the same rows: whether the money the holder fronted has come back.
  const [unpaidOnly, setUnpaidOnly] = useState(false)
  // The return the user has tapped, held while the question is on screen. An id plus the
  // direction, because the same button undoes as well as confirms.
  const [pendingReturn, setPendingReturn] = useState<{ id: string; repaid: boolean } | null>(null)

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

  // Filtering and sorting are pure functions of the rows and the settings, so they are
  // memoised together: without it every keystroke in the open form would re-sort the list.
  // The two filters compose — which pools, and whether the money is still owed — so "what
  // do I still owe out of the food pot?" is one view rather than two passes.
  const shown = useMemo(() => {
    const byPool = filterExpensesByPools(rows, poolFilter)
    return filterExpensesByDebt(byPool, unpaidOnly, moneyHolder)
  }, [rows, poolFilter, unpaidOnly, moneyHolder])
  const view = useMemo(() => arrangeExpenses(shown, sort), [shown, sort])
  // Follows the filter, exactly as the spent total does: the footer describes what is on
  // screen, and the count line below says how much of the camp that is.
  const owedCents = unreimbursedTotalCents(shown, moneyHolder)

  // Uniqueness is checked against the *whole* camp, never the filtered view: a number
  // hidden by a filter is still taken.
  const takenNumbers = takenReceiptNumbers(rows, editingRow?.id ?? null)
  const suggestedNumber = nextReceiptNumber(rows)

  const handleSave = (input: SaveExpenseInput) => {
    expenses.saveExpense(input)
    setEditing(null)
  }

  // The row the question is about, looked up at render time — if the other leader deletes
  // it mid-sync the dialog closes rather than quoting a row that is gone.
  const returning = pendingReturn === null ? undefined : rows.find((e) => e.id === pendingReturn.id)
  // Both directions name the person: "Returned?" alone does not say to whom, and on a
  // filtered list the row behind the dialog may not be the one you think it is.
  const returningName = returning?.paidBy?.trim() ?? ''

  /**
   * The deposit this receipt carries, when ticking it off would move it into a different
   * pocket. Paying somebody back settles everything that receipt left them out, deposit
   * included — so afterwards the books read as though the holder had stood at the till.
   * Zero when nobody else paid, or when there was no deposit to move.
   *
   * Nothing is written for it: the ledger reads the same flag, so the transfer follows the
   * receipt through every later edit and disappears with it on delete.
   */
  const movingPfandCents =
    returning === undefined || moneyHolder === undefined || isSamePayer(returningName, moneyHolder)
      ? 0
      : netPfandCents(returning)

  const handleConfirmReturn = () => {
    if (pendingReturn === null) return
    expenses.setReimbursed(pendingReturn.id, pendingReturn.repaid)
    setPendingReturn(null)
  }

  /**
   * What the return question says about the deposit: where it lands once the money is
   * settled, where it goes back to on an undo, and nothing at all on the receipts — nearly
   * all of them — that carry no deposit.
   */
  const pfandLines = (repaid: boolean): string[] => {
    if (movingPfandCents === 0 || moneyHolder === undefined) return []
    const payer = t.receipts.payer
    const amount = format.euros(Math.abs(movingPfandCents))

    if (!repaid) return [payer.confirmUndoPfandLine(amount, returningName)]
    // A negative net means the receipt gave back more deposit than it charged, so the
    // holder is taking on a refund that person has already had rather than a claim.
    return [
      movingPfandCents < 0
        ? payer.confirmReturnPfandOwedLine(amount, moneyHolder)
        : payer.confirmReturnPfandLine(amount, moneyHolder),
    ]
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
      // Every chip lit shows exactly the rows no chip lit shows, so the empty set wins:
      // switching the last pool on returns to the whole list rather than parking the filter
      // in a lit-up state that filters nothing.
      return next.size === spendable.length ? new Set() : next
    })
  }

  const pendingPoolName =
    summaries.find((s) => s.pool.id === pending?.poolId)?.pool.name ?? t.receipts.unknownPool

  const filtering = shown.length !== rows.length

  return (
    <Screen name="receipts" back={{ label: t.receipts.back, onClick: onBack }}>
      <header className="receipts__header">
        <h2 className="screen__title">{t.receipts.title}</h2>
        <div className="receipts__actions">
          <button className="btn btn--ghost" type="button" onClick={onOpenPfand}>
            {t.custody.pfand.overview}
          </button>
          <button
            className="btn btn--primary"
            type="button"
            disabled={locked || spendable.length === 0}
            onClick={() => setEditing({ mode: 'new' })}
          >
            {t.receipts.add}
          </button>
        </div>
      </header>

      {/* A write that only failed to *sync* says nothing — Instant queues it. This is for
          a write the server actually rejected. */}
      {expenses.error !== null && <Toast key={expenses.error} message={expenses.error} />}

      {editing?.mode === 'new' && (
        <ExpenseForm
          campId={campId}
          expense={null}
          pools={spendable}
          // Read at the edge and passed down, so nothing below here touches the clock.
          todayIso={todayIso()}
          takenNumbers={takenNumbers}
          suggestedNumber={suggestedNumber}
          moneyHolder={moneyHolder}
          campWindow={campWindow}
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
          canOwe={moneyHolder !== undefined}
          unpaidOnly={unpaidOnly}
          onUnpaidChange={setUnpaidOnly}
        />
      )}

      {/* "Nothing here yet" would be a lie for the first second, so the loading line wins
          while the query is still out. */}
      {rows.length === 0 && !locked && (
        <p className="income__empty">{expenses.isLoading ? t.app.loading : t.receipts.empty}</p>
      )}

      {/* An empty *filtered* list is a different message: there are receipts, just none the
          filters let through. "Not repaid" gets its own wording — an empty answer there is
          good news rather than a filter to loosen. */}
      {rows.length > 0 && shown.length === 0 && (
        <p className="income__empty">
          {unpaidOnly ? t.receipts.payer.emptyUnpaid : t.receipts.emptyFiltered}
        </p>
      )}

      <ExpenseDayList
        view={view}
        pools={summaries.map((s) => s.pool)}
        editingId={editingRow?.id ?? null}
        locked={locked}
        moneyHolder={moneyHolder}
        onEdit={(expenseId) => setEditing({ mode: 'edit', expenseId })}
        onDelete={(expenseId) => setPendingId(expenseId)}
        // Asked in both directions: the button sits in a list you scroll past with a
        // thumb, and both a stray "returned" and a stray undo quietly misstate who is owed
        // what.
        onToggleRepaid={(expenseId, repaid) => setPendingReturn({ id: expenseId, repaid })}
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
            moneyHolder={moneyHolder}
            campWindow={campWindow}
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
        {/* Only while something is outstanding: a line reading "owed 0,00" every day of
            camp is noise. It is money already spent, so it never joins the total above —
            what it tells you is that the cash box holds somebody else's money. */}
        {owedCents > 0 && (
          <p className="income__total-row receipts__owed">
            <span>{t.receipts.payer.owedTotal}</span>
            <strong>{format.euros(owedCents)}</strong>
          </p>
        )}

        <p className="income__total-row">
          <span>
            {filtering
              ? t.receipts.filterCount(shown.length, rows.length)
              : t.receipts.count(rows.length)}
          </span>
        </p>
      </footer>

      <ConfirmDialog
        open={returning !== undefined && pendingReturn !== null}
        title={
          pendingReturn === null
            ? ''
            : pendingReturn.repaid
              ? t.receipts.payer.confirmReturnTitle(returningName)
              : t.receipts.payer.confirmUndoTitle(returningName)
        }
        lines={
          returning === undefined || pendingReturn === null
            ? []
            : [
                pendingReturn.repaid
                  ? t.receipts.payer.confirmReturnLine(format.euros(returning.amountCents))
                  : t.receipts.payer.confirmUndoLine(format.euros(returning.amountCents)),
                // What travels with the money. Said plainly rather than offered as an
                // option: after a return the deposit is the holder's to reclaim.
                ...pfandLines(pendingReturn.repaid),
              ]
        }
        confirmLabel={
          pendingReturn?.repaid === false
            ? t.receipts.payer.confirmUndoLabel
            : t.receipts.payer.confirmReturnLabel
        }
        onConfirm={handleConfirmReturn}
        onCancel={() => setPendingReturn(null)}
      />

      <ConfirmDialog
        open={pending !== undefined}
        title={pending === undefined ? '' : t.receipts.deleteTitle(pending.name)}
        lines={
          pending === undefined
            ? []
            : [
                t.receipts.deleteLine(format.euros(pending.amountCents), pendingPoolName),
                // Deleting a receipt moves somebody's pfand balance, and there is nothing on
                // this screen that would show it — so the question says so before the tap
                // rather than leaving it to be noticed on the pfand screen later.
                ...(hasPfand(pending)
                  ? [
                      t.receipts.deletePfandLine(
                        // Whoever the deposit sits with now — the payer, or the holder once
                        // the receipt has been paid back.
                        pfandOwner(pending, moneyHolder),
                        // The *opposite* of what the receipt put into that pocket: taking
                        // the row away is what moves the balance, and by this much.
                        format.euros(-netPfandCents(pending)),
                      ),
                    ]
                  : []),
              ]
        }
        confirmLabel={t.receipts.confirmDelete}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingId(null)}
      />
    </Screen>
  )
}
