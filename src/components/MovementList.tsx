import { useFormat, useT } from '../i18n'
import { isDepositMovement, sortMovements } from '../lib/movements'
import type { Movement, Pool } from '../lib/types'
import { RowMenu } from './RowMenu'

type Props = {
  movements: Movement[]
  /** For naming the deposit a row belongs to. */
  pools: Pool[]
  /** The row that is unlocked, if any — it shows the form in place of the row. */
  editingId: string | null
  /** True while a form is open: every row's actions go inert, the same lock model as the
   *  receipts and income screens. */
  locked: boolean
  onEdit: (movementId: string) => void
  onDelete: (movementId: string) => void
  /** A render prop: the screen owns the form and its props, this list owns only where the
   *  form appears — in the edited row's slot, so nothing above it moves. */
  renderForm: () => React.ReactNode
}

/**
 * Flat, newest first. Not grouped by day like the receipts: a camp has a handful of
 * movements in total, and grouping three rows under three headings only adds noise.
 */
export function MovementList({
  movements,
  pools,
  editingId,
  locked,
  onEdit,
  onDelete,
  renderForm,
}: Props) {
  const t = useT()
  const format = useFormat()

  // A Map turns "which deposit is this?" into one lookup per row instead of a scan per row.
  const poolNames = new Map(pools.map((pool) => [pool.id, pool.name]))

  return (
    <ul className="movements__rows">
      {sortMovements(movements).map((movement) =>
        movement.id === editingId ? (
          // No `movement` class: the form brings its own card frame, and the row's border
          // around it would read as a box inside a box.
          <li key={movement.id}>{renderForm()}</li>
        ) : (
          <li className={`movement movement--${movement.kind}`} key={movement.id}>
            <div className="movement__main">
              <span className="movement__name">{movement.name}</span>
              <span className="movement__kind">{t.movements.kinds[movement.kind]}</span>
              <span className="movement__meta">
                {format.day(movement.date)}
                {isDepositMovement(movement) &&
                  ` · ${poolNames.get(movement.poolId) ?? t.movements.unknownPool}`}
              </span>
              {movement.note !== undefined && (
                <span className="movement__note">{movement.note}</span>
              )}
            </div>

            <span className="movement__amount">{format.euros(movement.amountCents)}</span>

            <RowMenu
              label={movement.name}
              disabled={locked}
              items={[
                { label: t.rowMenu.edit, onSelect: () => onEdit(movement.id) },
                { label: t.rowMenu.delete, danger: true, onSelect: () => onDelete(movement.id) },
              ]}
            />
          </li>
        ),
      )}
    </ul>
  )
}
