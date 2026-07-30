import { useFormat, useT } from '../i18n'
import { isDepositMovement, sortMovements } from '../lib/movements'
import type { Movement, Pool } from '../lib/types'

type Props = {
  movements: Movement[]
  /** For naming the deposit a row belongs to. */
  pools: Pool[]
  /** True while a form is open: every row's actions go inert, the same lock model as the
   *  receipts and income screens. */
  locked: boolean
  onEdit: (movementId: string) => void
  onDelete: (movementId: string) => void
}

/**
 * Flat, newest first. Not grouped by day like the receipts: a camp has a handful of
 * movements in total, and grouping three rows under three headings only adds noise.
 */
export function MovementList({ movements, pools, locked, onEdit, onDelete }: Props) {
  const t = useT()
  const format = useFormat()

  // A Map turns "which deposit is this?" into one lookup per row instead of a scan per row.
  const poolNames = new Map(pools.map((pool) => [pool.id, pool.name]))

  return (
    <ul className="movements__rows">
      {sortMovements(movements).map((movement) => (
        <li className={`movement movement--${movement.kind}`} key={movement.id}>
          <div className="movement__main">
            <span className="movement__name">{movement.name}</span>
            <span className="movement__kind">{t.movements.kinds[movement.kind]}</span>
            <span className="movement__meta">
              {format.day(movement.date)}
              {isDepositMovement(movement) &&
                ` · ${poolNames.get(movement.poolId) ?? t.movements.unknownPool}`}
            </span>
            {movement.note !== undefined && <span className="movement__note">{movement.note}</span>}
          </div>

          <span className="movement__amount">{format.euros(movement.amountCents)}</span>

          <div className="movement__actions">
            <button
              className="receipt__action"
              type="button"
              disabled={locked}
              aria-label={t.movements.editAction(movement.name)}
              onClick={() => onEdit(movement.id)}
            >
              {t.movements.edit}
            </button>
            <button
              className="receipt__action receipt__action--danger"
              type="button"
              disabled={locked}
              aria-label={t.movements.deleteAction(movement.name)}
              onClick={() => onDelete(movement.id)}
            >
              {t.movements.delete}
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
