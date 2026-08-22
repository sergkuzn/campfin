import './Custody.css'
import { useFormat, useT } from '../i18n'

type Props = {
  /** Participation fees you are holding for the organisation, in cents. */
  heldCents: number
  /** How many payments that total is made of — one row per handover. */
  count: number
}

/**
 * Participation fees collected for the organisation. The money only ever moves one way —
 * onward — so unlike a deposit there is nothing to reconcile, just a total and how it
 * accumulated.
 *
 * Nothing is rendered while the total is zero: both callers already say what an empty
 * block means, and a strip saying it too would put the same sentence on screen twice.
 */
export function FeeStrip({ heldCents, count }: Props) {
  const t = useT()
  const format = useFormat()

  if (heldCents === 0) return null

  return (
    <div className="custody">
      <div className="custody__row">
        <div className="custody__head">
          <span className="custody__name">{t.custody.fee.held}</span>
          <span className="custody__amount">{format.euros(heldCents)}</span>
        </div>
        <p className="custody__line">{t.custody.fee.count(count)}</p>
      </div>
    </div>
  )
}
