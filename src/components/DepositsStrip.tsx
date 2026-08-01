import './Custody.css'
import { useFormat, useT } from '../i18n'
import type { DepositStatus } from '../lib/movements'

type Props = {
  /** One reading per deposit pool, computed once by the parent. */
  statuses: DepositStatus[]
}

/**
 * Where each deposit currently sits. None of these figures is budget — a Kaution is
 * somebody else's money passing through your hands, which is why it gets a strip of its own
 * rather than a spent/left bar.
 */
export function DepositsStrip({ statuses }: Props) {
  const t = useT()

  if (statuses.length === 0) {
    return <p className="dashboard__slot-hint">{t.custody.deposits.empty}</p>
  }

  return (
    <div className="custody">
      {statuses.map((status) => (
        <DepositRow key={status.pool.id} status={status} />
      ))}
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
      ? { text: t.custody.deposits.atVendor(format.euros(status.atVendorCents)), state: 'out' }
      : status.atVendorCents < 0
        ? {
            text: t.custody.deposits.overReturned(format.euros(-status.atVendorCents)),
            state: 'odd',
          }
        : { text: t.custody.deposits.settled, state: 'settled' }

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
          {t.custody.deposits.forfeited(format.euros(status.forfeitedCents))}
        </p>
      )}

      <p className="custody__line">
        {t.custody.deposits.toReturn(format.euros(status.toReturnCents))}
      </p>
    </div>
  )
}
