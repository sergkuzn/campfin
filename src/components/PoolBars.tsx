import './PoolBars.css'
import { useFormat, useT } from '../i18n'
import { type PoolSummary, poolBar, spendablePools } from '../lib/pools'
import { PoolTag } from './PoolTag'

type Props = {
  /** This camp's pools. Deposit pools are filtered out here, not by the caller. */
  summaries: PoolSummary[]
  /** Start a receipt against one pool. The bar is where a leader already looks to decide
   *  whether there is room for a purchase, so it is also where entering one belongs. */
  onAdd: (poolId: string) => void
}

/**
 * One horizontal spent/left bar per pool you can spend from. A plain `<div>` with a width
 * percentage rather than a chart library — it has to be readable at 3 cm wide, and the
 * geometry is already a tested pure function (`poolBar`).
 */
export function PoolBars({ summaries, onAdd }: Props) {
  const spendable = spendablePools(summaries)

  return (
    <div className="bars">
      {spendable.map((summary) => (
        <PoolBarRow key={summary.pool.id} summary={summary} onAdd={onAdd} />
      ))}
    </div>
  )
}

/**
 * One segment's CSS width. Purely presentational: the row is rescaled so that funded (100
 * units) *plus* any overspend still fits its width — otherwise the overspend drawn past
 * the funded mark would run off a phone screen.
 */
function segmentWidth(units: number, overPercent: number): string {
  return `${(units / (100 + overPercent)) * 100}%`
}

function PoolBarRow({ summary, onAdd }: { summary: PoolSummary; onAdd: (poolId: string) => void }) {
  const t = useT()
  const format = useFormat()
  // Measured against what may be spent, not against what arrived: money for people who
  // never came would otherwise show as room left in the pool.
  const bar = poolBar(summary.entitledCents, summary.spentCents)

  // Same number, two readings: what is left, or by how much the pool is already over.
  const balance =
    summary.remainingCents < 0
      ? t.bars.over(format.euros(-summary.remainingCents))
      : t.bars.left(format.euros(summary.remainingCents))

  return (
    <div className="bars__row">
      {/* The reading and the action sit side by side: the bar keeps the full width it needs
          to stay legible, and the ＋ gets a tap target of its own that no thumb aiming at
          the bar can hit by accident. */}
      <div className="bars__body">
        <div className="bars__head">
          <span className="bars__name">
            {/* The dot, not the bar itself: the bar's colour is the budget state
                (green → amber → red), and one channel cannot carry two meanings. */}
            <PoolTag pool={summary.pool} variant="dot" />
            {summary.pool.name}
          </span>
          <span className={`bars__balance bars__balance--${bar.state}`}>{balance}</span>
        </div>

        {/* The track is the funded amount; the fill is what has been spent. Hidden from
            assistive tech because the line below states the same two figures in words —
            announcing them twice is worse than not drawing the bar at all. */}
        <div className={`bars__track bars__track--${bar.state}`} aria-hidden="true">
          <div
            className="bars__fill"
            style={{ width: segmentWidth(bar.fillPercent, bar.overPercent) }}
          />
          {/* Overspend is drawn *past* the funded mark instead of being clipped at 100%, so
              a merely full bar and an overspent one can never look the same. */}
          {bar.overPercent > 0 && (
            <>
              <div className="bars__mark" />
              <div
                className="bars__over"
                style={{ width: segmentWidth(bar.overPercent, bar.overPercent) }}
              />
            </>
          )}
        </div>

        <p className="bars__figures">
          {bar.state === 'empty'
            ? t.bars.unfunded
            : t.bars.spentOfFunded(
                format.euros(summary.spentCents),
                format.euros(summary.entitledCents),
              )}
        </p>
      </div>

      <button
        className="bars__add"
        type="button"
        // The glyph says nothing a screen reader could use, and "Add" alone would repeat
        // once per pool with no way to tell the buttons apart — the pool name is the label.
        aria-label={t.bars.addTo(summary.pool.name)}
        onClick={() => onAdd(summary.pool.id)}
      >
        <span aria-hidden="true">＋</span>
      </button>
    </div>
  )
}
