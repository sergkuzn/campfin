import { useFormat, useT } from '../i18n'
import { blockCents, blockPersonDays } from '../lib/budget'
import { dayCount } from '../lib/dates'
import type { IncomeSource, PerDiemBlock } from '../lib/types'

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

      {blocks.map((block) => {
        const days = dayCount(block.startDate, block.endDate)
        const personDays = blockPersonDays(block.numPersons, block.startDate, block.endDate)
        return (
          <div key={block.id} className="card__block">
            <p className="card__block-row card__block-row--head">
              <span>{block.label ?? t.blocks.fallbackLabel}</span>
              <strong>
                {format.euros(
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
                {t.blocks.peopleAtRate(block.numPersons, format.euros(block.ratePerPersonDayCents))}
              </span>
              <span>{t.blocks.personDays(personDays)}</span>
            </p>
            <p className="card__block-row">
              <span>
                {block.startDate} – {block.endDate}
              </span>
              <span>{t.blocks.days(days)}</span>
            </p>
          </div>
        )
      })}

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
