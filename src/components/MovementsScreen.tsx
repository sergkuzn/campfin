import { useState } from 'react'
import './MovementsScreen.css'
import type { UseMovements } from '../hooks/useMovements'
import { useFormat, useT } from '../i18n'
import { todayIso } from '../lib/dates'
import type { CustodyReading, SaveMovementInput } from '../lib/movements'
import type { PoolSummary } from '../lib/pools'
import { ConfirmDialog } from './ConfirmDialog'
import { CustodyStrip } from './CustodyStrip'
import { MovementForm } from './MovementForm'
import { MovementList } from './MovementList'

type Props = {
  campId: string
  movements: UseMovements
  /** Deposit pools only — everything on this screen is custody money. */
  deposits: PoolSummary[]
  /** Computed once by the parent, so the strip here and on the dashboard agree. */
  custody: CustodyReading
  onBack: () => void
}

/** Which movement is unlocked. One at a time — the same lock model as the other screens. */
type Editing = { mode: 'new' } | { mode: 'edit'; movementId: string }

export function MovementsScreen({ campId, movements, deposits, custody, onBack }: Props) {
  const t = useT()
  const format = useFormat()

  const [editing, setEditing] = useState<Editing | null>(null)
  // Ids only: the confirm question derives its numbers at render time, so it can never
  // quote a stale amount.
  const [pendingId, setPendingId] = useState<string | null>(null)

  const rows = movements.movements
  const editingRow =
    editing?.mode === 'edit' ? (rows.find((m) => m.id === editing.movementId) ?? null) : null
  // `find` gives undefined once the row is gone — deleted here or by the other leader
  // mid-sync — and the dialog simply closes rather than quoting a row that no longer exists.
  const pending = pendingId === null ? undefined : rows.find((m) => m.id === pendingId)

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
      <button className="dashboard__back" type="button" onClick={onBack}>
        {t.movements.back}
      </button>

      <header className="movements__header">
        <h2 className="movements__title">{t.movements.title}</h2>
        <button
          className="income-form__button"
          type="button"
          disabled={editing !== null}
          onClick={() => setEditing({ mode: 'new' })}
        >
          {t.movements.add}
        </button>
      </header>

      {/* A write that only failed to *sync* says nothing — Instant queues it. This is for
          a write the server actually rejected. */}
      {movements.error !== null && (
        <p className="income__error" role="alert">
          {movements.error}
        </p>
      )}

      <CustodyStrip custody={custody} />

      {/* Volunteer money is always recordable, so the hint explains the *missing* half:
          without a deposit source there is no Kaution to hand over. */}
      {deposits.length === 0 && <p className="dashboard__slot-hint">{t.movements.noDeposits}</p>}

      {editing?.mode === 'new' && (
        <MovementForm
          campId={campId}
          movement={null}
          deposits={deposits}
          // Read at the edge and passed down, so nothing below here touches the clock.
          todayIso={todayIso()}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {editingRow !== null && (
        <MovementForm
          // Re-seed the draft when the user switches to a different row.
          key={editingRow.id}
          campId={campId}
          movement={editingRow}
          deposits={deposits}
          todayIso={todayIso()}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {/* "Nothing here yet" would be a lie for the first second, so the loading line wins
          while the query is still out. */}
      {rows.length === 0 && editing === null && (
        <p className="income__empty">{movements.isLoading ? t.app.loading : t.movements.empty}</p>
      )}

      <MovementList
        movements={rows}
        pools={deposits.map((s) => s.pool)}
        locked={editing !== null}
        onEdit={(movementId) => setEditing({ mode: 'edit', movementId })}
        onDelete={(movementId) => setPendingId(movementId)}
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
