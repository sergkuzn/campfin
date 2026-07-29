import { blockCents, blockPersonDays, formatEuros } from '../lib/budget'
import { dayCount } from '../lib/dates'
import type { IncomeSource, PerDiemBlock } from '../lib/types'
import { incomeType } from './incomeTypes'

type Props = {
  source: IncomeSource
  blocks: PerDiemBlock[] // already filtered to this source
  amountCents: number // from sourceAmountCents — do not recompute here
  /** Another card is open for editing, so this one's buttons are inert. */
  disabled: boolean
  onEdit: () => void
  onDelete: () => void
}

/** A saved (locked) income source. Renders numbers it is handed; does no arithmetic. */
export function IncomeSourceCard({
  source,
  blocks,
  amountCents,
  disabled,
  onEdit,
  onDelete,
}: Props) {
  return (
    <article className="card">
      <header className="card__header">
        <span className="card__lock" aria-hidden="true">
          🔒
        </span>
        <span className="card__name">{source.name}</span>
        <span className="card__kind">{incomeType(source.kind).label}</span>
        <span className="card__amount">{formatEuros(amountCents)}</span>
      </header>

      {blocks.map((block) => {
        const days = dayCount(block.startDate, block.endDate)
        const personDays = blockPersonDays(block.numPersons, block.startDate, block.endDate)
        return (
          <div key={block.id} className="card__block">
            <p className="card__block-row card__block-row--head">
              <span>{block.label ?? 'Block'}</span>
              <strong>
                {formatEuros(
                  blockCents(
                    block.numPersons,
                    block.ratePerPersonDayCents,
                    block.startDate,
                    block.endDate,
                  ),
                )}
              </strong>
            </p>
            <p className="card__block-row">
              <span>
                {block.numPersons} ppl × {formatEuros(block.ratePerPersonDayCents)}/day
              </span>
              <span>{personDays} person-days</span>
            </p>
            <p className="card__block-row">
              <span>
                {block.startDate} – {block.endDate}
              </span>
              <span>
                {days} {days === 1 ? 'day' : 'days'}
              </span>
            </p>
          </div>
        )
      })}

      <div className="card__actions">
        <button className="card__button" type="button" onClick={onEdit} disabled={disabled}>
          Edit
        </button>
        <button className="card__button" type="button" onClick={onDelete} disabled={disabled}>
          Delete
        </button>
      </div>
    </article>
  )
}
