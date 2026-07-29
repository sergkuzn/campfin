import './ReceivedTotals.css'
import { useFormat, useT } from '../i18n'
import { type PoolSummary, receivedTotalCents } from '../lib/pools'

type Props = {
  summaries: PoolSummary[]
}

/** The received side of the settlement, one row per pool plus the total. */
export function ReceivedTotals({ summaries }: Props) {
  const t = useT()
  const format = useFormat()

  // The everyday pool exists from the camp's first second, so an empty *pool* list no
  // longer means an empty camp — an unfunded one does.
  if (summaries.every((summary) => summary.sources.length === 0)) {
    return <p className="dashboard__slot-hint">{t.dashboard.noIncome}</p>
  }

  return (
    <dl className="received">
      {summaries.map((summary) => (
        <div key={summary.pool.id} className="received__row">
          <dt>{summary.pool.name}</dt>
          <dd>{format.euros(summary.fundedCents)}</dd>
        </div>
      ))}
      <div className="received__row received__row--total">
        <dt>{t.dashboard.receivedTotal}</dt>
        <dd>{format.euros(receivedTotalCents(summaries))}</dd>
      </div>
    </dl>
  )
}
