import './Custody.css'
import { useFormat, useT } from '../i18n'

type Props = {
  /** Volunteers' cash you are holding for the organisation, in cents. */
  heldCents: number
  /** How many handovers that total is made of — one row per volunteer. */
  count: number
}

/**
 * Cash collected from volunteers. It only ever moves one way — onward to the organisation —
 * so unlike a deposit there is nothing to reconcile, just a total and how it accumulated.
 */
export function CashStrip({ heldCents, count }: Props) {
  const t = useT()
  const format = useFormat()

  if (heldCents === 0) {
    return <p className="dashboard__slot-hint">{t.custody.cash.empty}</p>
  }

  return (
    <div className="custody">
      <div className="custody__row">
        <div className="custody__head">
          <span className="custody__name">{t.custody.cash.held}</span>
          <span className="custody__amount">{format.euros(heldCents)}</span>
        </div>
        <p className="custody__line">{t.custody.cash.count(count)}</p>
      </div>
    </div>
  )
}
