import { useState } from 'react'
import './MovementsScreen.css'
import type { UseMovements } from '../hooks/useMovements'
import { useFormat, useT } from '../i18n'
import type { CampWindow } from '../lib/camps'
import { todayIso } from '../lib/dates'
import {
  type CustodyFocus,
  type CustodyReading,
  movementsInFocus,
  type SaveMovementInput,
} from '../lib/movements'
import type { PoolSummary } from '../lib/pools'
import { ConfirmDialog } from './ConfirmDialog'
import { DepositsStrip } from './DepositsStrip'
import { FeeStrip } from './FeeStrip'
import { MovementForm } from './MovementForm'
import { MovementList } from './MovementList'
import { Toast } from './Toast'

type Props = {
  campId: string
  /** Which half of the custody money this screen is showing. */
  focus: CustodyFocus
  movements: UseMovements
  /** Deposit pools only — everything on this screen is custody money. */
  deposits: PoolSummary[]
  /** Computed once by the parent, so the strip here and on the dashboard agree. */
  custody: CustodyReading
  /** The camp's span, for the date picker in the form below. `null` until per-diem income
   *  dates the camp. */
  campWindow: CampWindow | null
  onBack: () => void
}

/** Which movement is unlocked. One at a time — the same lock model as the other screens. */
type Editing = { mode: 'new' } | { mode: 'edit'; movementId: string }

export function MovementsScreen({
  campId,
  focus,
  movements,
  deposits,
  custody,
  campWindow,
  onBack,
}: Props) {
  const t = useT()
  const format = useFormat()

  const [editing, setEditing] = useState<Editing | null>(null)
  // Ids only: the confirm question derives its numbers at render time, so it can never
  // quote a stale amount.
  const [pendingId, setPendingId] = useState<string | null>(null)

  const labels = t.movements[focus]
  // Nothing can be recorded here yet: the deposit kinds have no pool to point at.
  const missingDeposits = focus === 'deposits' && deposits.length === 0
  // Only this half's rows: a screen headed "Deposits" listing participation fees would undo
  // the split the dashboard makes. The form below is limited to the same half.
  const rows = movementsInFocus(movements.movements, focus)
  const editingRow =
    editing?.mode === 'edit' ? (rows.find((m) => m.id === editing.movementId) ?? null) : null
  // `find` gives undefined once the row is gone — deleted here or by the other leader
  // mid-sync — and the dialog simply closes rather than quoting a row that no longer exists.
  const pending = pendingId === null ? undefined : rows.find((m) => m.id === pendingId)
  // A row can vanish under an open form — the other leader deleted it mid-sync. Nothing is
  // unlocked then, so the rest of the screen must not stay inert with no form to cancel.
  const locked = editing?.mode === 'new' || editingRow !== null

  const handleSave = (input: SaveMovementInput) => {
    movements.saveMovement(input)
    setEditing(null)
  }

  const handleConfirmDelete = () => {
    if (pendingId !== null) movements.deleteMovement(pendingId)
    setPendingId(null)
  }

  return (
    <div className="movements">
      <button className="screen-back" type="button" onClick={onBack}>
        {t.movements.back}
      </button>

      <header className="movements__header">
        <h2 className="movements__title">{labels.title}</h2>
        <button
          className="btn btn--primary"
          type="button"
          disabled={locked || missingDeposits}
          onClick={() => setEditing({ mode: 'new' })}
        >
          {labels.add}
        </button>
      </header>

      {/* A write that only failed to *sync* says nothing — Instant queues it. This is for
          a write the server actually rejected. */}
      {movements.error !== null && <Toast key={movements.error} message={movements.error} />}

      {focus === 'deposits' ? (
        <DepositsStrip statuses={custody.statuses} />
      ) : (
        <FeeStrip heldCents={custody.feeHeldCents} count={custody.feeCount} />
      )}

      {/* Without a deposit source there is no Kaution to hand over, so say what is missing
          rather than offering a form whose pool picker would be empty. */}
      {missingDeposits && <p className="slot-card__hint">{t.movements.deposits.noDeposits}</p>}

      {editing?.mode === 'new' && (
        <MovementForm
          campId={campId}
          focus={focus}
          movement={null}
          deposits={deposits}
          statuses={custody.statuses}
          // Read at the edge and passed down, so nothing below here touches the clock.
          todayIso={todayIso()}
          campWindow={campWindow}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {/* "Nothing here yet" would be a lie for the first second, so the loading line wins
          while the query is still out — and the hint above already explains an empty
          deposits screen, so this would only repeat it. */}
      {rows.length === 0 && !locked && !missingDeposits && (
        <p className="income__empty">{movements.isLoading ? t.app.loading : labels.empty}</p>
      )}

      <MovementList
        movements={rows}
        pools={deposits.map((s) => s.pool)}
        editingId={editingRow?.id ?? null}
        locked={locked}
        onEdit={(movementId) => setEditing({ mode: 'edit', movementId })}
        onDelete={(movementId) => setPendingId(movementId)}
        // Called only for the edited row. Switching rows moves the form to a different
        // <li>, which remounts it, so the draft re-seeds without a `key` of its own.
        renderForm={() => (
          <MovementForm
            campId={campId}
            focus={focus}
            movement={editingRow}
            deposits={deposits}
            statuses={custody.statuses}
            todayIso={todayIso()}
            campWindow={campWindow}
            onSave={handleSave}
            onCancel={() => setEditing(null)}
          />
        )}
      />

      <footer className="income__totals">
        <p className="income__total-row">
          <span>{t.movements.count(rows.length)}</span>
        </p>
      </footer>

      <ConfirmDialog
        open={pending !== undefined}
        title={pending === undefined ? '' : t.movements.deleteTitle(pending.name)}
        lines={
          pending === undefined
            ? []
            : [
                t.movements.deleteLine(
                  t.movements.kinds[pending.kind],
                  format.euros(pending.amountCents),
                ),
              ]
        }
        confirmLabel={t.movements.confirmDelete}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingId(null)}
      />
    </div>
  )
}
