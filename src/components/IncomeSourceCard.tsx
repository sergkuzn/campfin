import { useFormat, useT } from '../i18n'
import type { PerDiemTotals } from '../lib/budget'
import type { IncomeSource, PerDiemBlock } from '../lib/types'
import { BlockList } from './BlockList'
import { PerDiemAttendance } from './PerDiemAttendance'

/** The granted/actual half of a per-diem card. One optional prop group rather than six
 *  loose optional props, so "either a card has attendance or it doesn't" stays checkable. */
type Attendance = {
  actualBlocks: PerDiemBlock[]
  totals: PerDiemTotals
  editing: boolean
  onEdit: (seedFromGranted: boolean) => void
  renderForm: () => React.ReactNode
}

type Props = {
  source: IncomeSource
  /** Granted blocks of this source; `[]` for a fixed grant or a deposit. */
  blocks: PerDiemBlock[]
  amountCents: number // from sourceAmountCents — do not recompute here
  /** Another card is open for editing, so this one's buttons are inert. */
  disabled: boolean
  /** Present only for the per-diem source, which is the only kind that has attendance. */
  attendance?: Attendance
  onEdit: () => void
  onDelete: () => void
}

/** A saved (locked) income source. Renders numbers it is handed; does no arithmetic. */
export function IncomeSourceCard({
  source,
  blocks,
  amountCents,
  disabled,
  attendance,
  onEdit,
  onDelete,
}: Props) {
  const t = useT()
  const format = useFormat()

  return (
    <article className="card">
      <header className="card__header">
        <span className="card__lock" aria-hidden="true">
          🔒
        </span>
        <span className="card__name">{source.name}</span>
        <span className="card__kind">{t.income.kinds[source.kind].label}</span>
        <span className="card__amount">{format.euros(amountCents)}</span>
      </header>

      {attendance === undefined ? (
        <BlockList blocks={blocks} />
      ) : (
        <PerDiemAttendance
          grantedBlocks={blocks}
          actualBlocks={attendance.actualBlocks}
          totals={attendance.totals}
          editing={attendance.editing}
          disabled={disabled}
          onEdit={attendance.onEdit}
          renderForm={attendance.renderForm}
        />
      )}

      <div className="card__actions">
        <button className="card__button" type="button" onClick={onEdit} disabled={disabled}>
          {t.income.edit}
        </button>
        <button className="card__button" type="button" onClick={onDelete} disabled={disabled}>
          {t.income.delete}
        </button>
      </div>
    </article>
  )
}
