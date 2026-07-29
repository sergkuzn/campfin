import './ReceivedTotals.css'
import { formatEuros } from '../lib/budget'
import { type PoolSummary, receivedTotalCents } from '../lib/pools'

type Props = {
  summaries: PoolSummary[]
}

/** The received side of the settlement, one row per pool plus the total. */
export function ReceivedTotals({ summaries }: Props) {
  if (summaries.length === 0) {
    return <p className="dashboard__slot-hint">No income sources yet.</p>
  }

  return (
    <dl className="received">
      {summaries.map((summary) => (
        <div key={summary.pool.id} className="received__row">
          <dt>{summary.pool.name}</dt>
          <dd>{formatEuros(summary.fundedCents)}</dd>
        </div>
      ))}
      <div className="received__row received__row--total">
        <dt>Received total</dt>
        <dd>{formatEuros(receivedTotalCents(summaries))}</dd>
      </div>
    </dl>
  )
}
