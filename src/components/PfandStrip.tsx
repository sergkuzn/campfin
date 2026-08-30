import './Custody.css'
import { useFormat, useT } from '../i18n'

type Props = {
  /** Deposit money the camp's people are collectively out, in cents. */
  outCents: number
  /** How many pockets that total is spread over. */
  peopleCount: number
}

/**
 * Deposit money, on the dashboard. One figure and a count, the same shape the fee block
 * uses — the detail is per person, and that is what the screen behind the card is for.
 *
 * Zero gets a sentence rather than "0,00 €": once it is all reclaimed the answer is
 * "nothing to do", and a total is a poor way of saying it.
 */
export function PfandStrip({ outCents, peopleCount }: Props) {
  const t = useT()
  const format = useFormat()

  if (outCents === 0) {
    return <p className="slot-card__hint">{t.custody.pfand.settled}</p>
  }

  return (
    <div className="custody">
      <div className="custody__row">
        <div className="custody__head">
          <span className="custody__name">{t.custody.pfand.out}</span>
          <span className="custody__amount">{format.euros(outCents)}</span>
        </div>
        <p className="custody__line">{t.custody.pfand.count(peopleCount)}</p>
      </div>
    </div>
  )
}
