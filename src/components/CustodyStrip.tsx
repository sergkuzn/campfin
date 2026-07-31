import './CustodyStrip.css'
import { useFormat, useT } from '../i18n'
import type { CustodyReading, DepositStatus } from '../lib/movements'

type Props = {
  /** Every deposit's reading plus the volunteer money, computed once by the parent. */
  custody: CustodyReading
}

/**
 * Where the custody money currently sits: one row per deposit, plus the volunteer total.
 * None of these figures is budget — a deposit is somebody else's money passing through
 * your hands, which is why it gets a strip of its own rather than a spent/left bar.
 */
export function CustodyStrip({ custody }: Props) {
  const t = useT()
  const format = useFormat()

  if (custody.statuses.length === 0 && custody.volunteerHeldCents === 0) {
    return <p className="dashboard__slot-hint">{t.custody.empty}</p>
  }

  return (
    <div className="custody">
      {custody.statuses.map((status) => (
        <DepositRow key={status.pool.id} status={status} />
      ))}

      {custody.volunteerHeldCents > 0 && (
        <div className="custody__row">
          <div className="custody__head">
            <span className="custody__name">{t.custody.volunteers}</span>
            <span className="custody__amount">{format.euros(custody.volunteerHeldCents)}</span>
          </div>
          <p className="custody__line">{t.custody.volunteerCount(custody.volunteerCount)}</p>
        </div>
      )}
    </div>
  )
}

function DepositRow({ status }: { status: DepositStatus }) {
  const t = useT()
  const format = useFormat()

  // Three readings of the same deposit, and only one of them is ever the interesting one:
  // still out at a counterparty, back in your pocket, or — a mistake — over-returned.
  const whereItIs =
    status.atVendorCents > 0
      ? { text: t.custody.atVendor(format.euros(status.atVendorCents)), state: 'out' }
      : status.atVendorCents < 0
        ? { text: t.custody.overReturned(format.euros(-status.atVendorCents)), state: 'odd' }
        : { text: t.custody.settled, state: 'settled' }

  return (
    <div className="custody__row">
      <div className="custody__head">
        <span className="custody__name">{status.pool.name}</span>
        <span className="custody__amount">{format.euros(status.fundedCents)}</span>
      </div>

      <p className={`custody__line custody__line--${whereItIs.state}`}>{whereItIs.text}</p>

      {/* Only worth a line when it happened: a Kaution the counterparty kept is the one
          part of a deposit that never comes back. */}
      {status.forfeitedCents > 0 && (
        <p className="custody__line custody__line--kept">
          {t.custody.forfeited(format.euros(status.forfeitedCents))}
        </p>
      )}

      <p className="custody__line">{t.custody.toReturn(format.euros(status.toReturnCents))}</p>
    </div>
  )
}
