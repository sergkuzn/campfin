import { useFormat, useT } from '../i18n'
import { blockCents, blockPersonDays } from '../lib/budget'
import { dayCount } from '../lib/dates'
import type { PerDiemBlock } from '../lib/types'

type Props = {
  /** Already filtered to one source and one variant by the caller. */
  blocks: PerDiemBlock[]
}

/** Saved per-diem blocks, read-only: label, money, people × rate, dates. Used by both the
 *  granted and the actual side of a per-diem card, so the two always read identically. */
export function BlockList({ blocks }: Props) {
  const t = useT()
  const format = useFormat()

  return (
    <>
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
    </>
  )
}
