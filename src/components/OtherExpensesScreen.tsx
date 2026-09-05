import { useState } from 'react'
import './OtherExpensesScreen.css'
import type { UseOtherExpenses } from '../hooks/useOtherExpenses'
import { useFormat, useT } from '../i18n'
import type { CampWindow } from '../lib/camps'
import { todayIso } from '../lib/dates'
import { otherExpensesTotalCents, type SaveOtherExpenseInput } from '../lib/otherExpenses'
import { unreimbursedTotalCents } from '../lib/payers'
import { ConfirmDialog } from './ConfirmDialog'
import { InfoToggle } from './InfoToggle'
import { OtherExpenseForm } from './OtherExpenseForm'
import { OtherExpenseList } from './OtherExpenseList'
import { Screen } from './Screen'
import { Toast } from './Toast'

type Props = {
  campId: string
  /** Who holds the camp cash. Every "owed" marker is measured against this name, and while
   *  it is absent nothing on the screen owes anybody anything. */
  moneyHolder: string | undefined
  /** The camp's known span, so the date field can highlight it. `null` when the camp has no
   *  per-diem income yet. */
  campWindow: CampWindow | null
  otherExpenses: UseOtherExpenses
  onBack: () => void
}

/** Which row is unlocked. One at a time — the same lock model as the other screens. */
type Editing = { mode: 'new' } | { mode: 'edit'; expenseId: string }

/**
 * Money the camp's income does not cover: a leader pays for it themselves and the
 * organisation compensates it afterwards. No pool to pick, no receipt number, no pfand —
 * what is being written down is a claim, not a slip for the camp's folder.
 */
export function OtherExpensesScreen({
  campId,
  moneyHolder,
  campWindow,
  otherExpenses,
  onBack,
}: Props) {
  const t = useT()
  const format = useFormat()

  const [editing, setEditing] = useState<Editing | null>(null)
  // Ids only: the confirm question derives its numbers at render time, so it can never
  // quote a stale amount.
  const [pendingId, setPendingId] = useState<string | null>(null)
  // The return the user has tapped, held while the question is on screen. An id plus the
  // direction, because the same button undoes as well as confirms.
  const [pendingReturn, setPendingReturn] = useState<{ id: string; repaid: boolean } | null>(null)
  // Whether the ⓘ beside the title is open. Closed to begin with: what this screen is for is
  // a question you have once, and a line explaining it on every visit is a line in the way.
  const [infoOpen, setInfoOpen] = useState(false)

  const rows = otherExpenses.otherExpenses
  const editingRow =
    editing?.mode === 'edit' ? (rows.find((e) => e.id === editing.expenseId) ?? null) : null
  // `find` gives undefined once the row is gone — deleted here or by the other leader
  // mid-sync — and the dialog simply closes rather than quoting a row that no longer exists.
  const pending = pendingId === null ? undefined : rows.find((e) => e.id === pendingId)
  const returning = pendingReturn === null ? undefined : rows.find((e) => e.id === pendingReturn.id)
  // Both directions name the person: "Returned?" alone does not say to whom.
  const returningName = returning?.paidBy.trim() ?? ''
  // A row can vanish under an open form — the other leader deleted it mid-sync. Nothing is
  // unlocked then, so the rest of the screen must not stay inert with no form to cancel.
  const locked = editing?.mode === 'new' || editingRow !== null

  // What the organisation owes back, and how much of that is still a co-leader's own money
  // rather than the holder's. The second is a subset of the first, never added to it.
  const totalCents = otherExpensesTotalCents(rows)
  const owedCents = unreimbursedTotalCents(rows, moneyHolder)

  const handleSave = (input: SaveOtherExpenseInput) => {
    otherExpenses.saveOtherExpense(input)
    setEditing(null)
  }

  const handleConfirmReturn = () => {
    if (pendingReturn === null) return
    otherExpenses.setReimbursed(pendingReturn.id, pendingReturn.repaid)
    setPendingReturn(null)
  }

  const handleConfirmDelete = () => {
    if (pendingId !== null) otherExpenses.deleteOtherExpense(pendingId)
    setPendingId(null)
  }

  return (
    <Screen name="other-expenses" back={{ label: t.otherExpenses.back, onClick: onBack }}>
      <header className="other-expenses__header">
        <h2 className="screen__title">{t.otherExpenses.title}</h2>
        <InfoToggle
          label={t.otherExpenses.infoLabel}
          open={infoOpen}
          controls="other-expenses-hint"
          onToggle={() => setInfoOpen((open) => !open)}
        />
        <button
          className="btn btn--primary other-expenses__add"
          type="button"
          disabled={locked}
          onClick={() => setEditing({ mode: 'new' })}
        >
          {t.otherExpenses.add}
        </button>
      </header>

      {infoOpen && (
        <p className="slot-card__hint" id="other-expenses-hint">
          {t.otherExpenses.hint}
        </p>
      )}

      {/* A write that only failed to *sync* says nothing — Instant queues it. This is for
          a write the server actually rejected. */}
      {otherExpenses.error !== null && (
        <Toast key={otherExpenses.error} message={otherExpenses.error} />
      )}

      {editing?.mode === 'new' && (
        <OtherExpenseForm
          campId={campId}
          expense={null}
          // Read at the edge and passed down, so nothing below here touches the clock.
          todayIso={todayIso()}
          moneyHolder={moneyHolder}
          campWindow={campWindow}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {/* "Nothing here yet" would be a lie for the first second, so the loading line wins
          while the query is still out. */}
      {rows.length === 0 && !locked && (
        <p className="income__empty">
          {otherExpenses.isLoading ? t.app.loading : t.otherExpenses.empty}
        </p>
      )}

      <OtherExpenseList
        expenses={rows}
        editingId={editingRow?.id ?? null}
        locked={locked}
        moneyHolder={moneyHolder}
        onEdit={(expenseId) => setEditing({ mode: 'edit', expenseId })}
        onDelete={(expenseId) => setPendingId(expenseId)}
        // Asked in both directions: the button sits in a list you scroll past with a thumb,
        // and both a stray "returned" and a stray undo misstate who is owed what.
        onToggleRepaid={(expenseId, repaid) => setPendingReturn({ id: expenseId, repaid })}
        // Called only for the edited row. Switching rows moves the form to a different
        // <li>, which remounts it, so the draft re-seeds without a `key` of its own.
        renderForm={() => (
          <OtherExpenseForm
            campId={campId}
            expense={editingRow}
            todayIso={todayIso()}
            moneyHolder={moneyHolder}
            campWindow={campWindow}
            onSave={handleSave}
            onCancel={() => setEditing(null)}
          />
        )}
      />

      <footer className="income__totals">
        <p className="income__total-row">
          <span>{t.otherExpenses.total}</span>
          <strong>{format.euros(totalCents)}</strong>
        </p>
        {/* Only while something is outstanding: a line reading "owed 0,00" every day of camp
            is noise. It is a slice of the total above, not money on top of it — what it says
            is which part of the claim is still a co-leader's own. */}
        {owedCents > 0 && (
          <p className="income__total-row other-expenses__owed">
            <span>{t.receipts.payer.owedTotal}</span>
            <strong>{format.euros(owedCents)}</strong>
          </p>
        )}
        <p className="income__total-row">
          <span>{t.otherExpenses.count(rows.length)}</span>
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
        title={pending === undefined ? '' : t.otherExpenses.deleteTitle(pending.name)}
        lines={
          pending === undefined
            ? []
            : [t.otherExpenses.deleteLine(format.euros(pending.amountCents))]
        }
        confirmLabel={t.otherExpenses.confirmDelete}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingId(null)}
      />
    </Screen>
  )
}
