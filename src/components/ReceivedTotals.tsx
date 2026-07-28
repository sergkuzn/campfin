import './ReceivedTotals.css'
import { formatEuros } from '../lib/budget'
import { computeSettlement } from '../lib/settlement'
import type { Contribution, IncomeSource, PerDiemBlock } from '../lib/types'

type Props = {
  sources: IncomeSource[]
  blocks: PerDiemBlock[]
  contributions: Contribution[]
}

/** The received side of the settlement, split by how each pot behaves. */
export function ReceivedTotals({ sources, blocks, contributions }: Props) {
  // Money received is independent of spending, so expenses are [] until milestone 4.
  // With no expenses, breakdown.reservedRemainingCents equals the reserved grant total.
  const { receivedTotalCents, breakdown } = computeSettlement(sources, blocks, [], contributions)

  if (sources.length === 0) {
    return <p className="dashboard__slot-hint">No income sources yet.</p>
  }

  return (
    <dl className="received">
      <div className="received__row">
        <dt>Gradual pool</dt>
        <dd>{formatEuros(breakdown.gradualBudgetCents)}</dd>
      </div>
      <div className="received__row">
        <dt>Reserved (earmarked)</dt>
        <dd>{formatEuros(breakdown.reservedRemainingCents)}</dd>
      </div>
      <div className="received__row">
        <dt>Pass-through</dt>
        <dd>{formatEuros(breakdown.passthroughCents)}</dd>
      </div>
      <div className="received__row received__row--total">
        <dt>Received total</dt>
        <dd>{formatEuros(receivedTotalCents)}</dd>
      </div>
    </dl>
  )
}
