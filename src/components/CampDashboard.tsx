import './CampDashboard.css'
import { useFormat, useT } from '../i18n'
import type { Burn } from '../lib/burn'
import { campStatus } from '../lib/camps'
import type { CustodyReading } from '../lib/movements'
import type { PoolSummary } from '../lib/pools'
import type { Settlement } from '../lib/settlement'
import type { Camp } from '../lib/types'
import { AllowedToday } from './AllowedToday'
import { BurnChart } from './BurnChart'
import { CustodyStrip } from './CustodyStrip'
import { PoolBars } from './PoolBars'
import { ReceivedTotals } from './ReceivedTotals'
import { StatusPill } from './StatusPill'

type Props = {
  camp: Camp
  /** This camp's pools only — the parent has already filtered by campId. */
  summaries: PoolSummary[]
  /** The day-by-day reading. `hasCurve` false means the camp has no daily grant yet. */
  burn: Burn
  /** One clock read for the whole screen, passed in so the status pill, the burn math
   *  and the chart's "today" line can never disagree mid-render. */
  todayIso: string
  /** How many leaders share this camp. A count, never names. */
  memberCount: number
  /** Only the camp's creator is offered the delete button. */
  isAdmin: boolean
  isLoading: boolean
  error: string | null
  /** Whether any receipt exists yet — the bars alone cannot say so, since an
   *  untouched pool and a camp with no receipts look the same. */
  hasExpenses: boolean
  /** Cash held rather than spent: the deposits and the volunteer money. */
  custody: CustodyReading
  /** The end-of-camp reading. Only its total shows here; the sheet explains it. */
  settlement: Settlement
  onBack: () => void
  onOpenIncome: () => void
  onOpenReceipts: () => void
  onOpenMovements: () => void
  onOpenSettlement: () => void
  onRename: (campId: string, name: string) => void
  onDelete: (campId: string) => void
}

/**
 * The camp hub.
 */
export function CampDashboard({
  camp,
  summaries,
  burn,
  todayIso,
  memberCount,
  isAdmin,
  isLoading,
  error,
  hasExpenses,
  custody,
  settlement,
  onBack,
  onOpenIncome,
  onOpenReceipts,
  onOpenMovements,
  onOpenSettlement,
  onRename,
  onDelete,
}: Props) {
  const t = useT()
  const format = useFormat()

  const handleRename = () => {
    const next = window.prompt(t.dashboard.renamePrompt, camp.name)
    // `prompt` returns null on cancel — an empty string means "cleared it", also a no-op.
    if (next !== null && next.trim() !== '') onRename(camp.id, next)
  }

  const handleDelete = () => {
    if (window.confirm(t.dashboard.deleteConfirm(camp.name))) onDelete(camp.id)
  }

  const funded = summaries.some((summary) => summary.sources.length > 0)

  return (
    <div className="dashboard">
      <button className="dashboard__back" type="button" onClick={onBack}>
        {t.dashboard.back}
      </button>

      <header className="dashboard__header">
        <h2 className="dashboard__name">{camp.name}</h2>
        <StatusPill status={campStatus(camp, todayIso)} />
      </header>

      <section className="dashboard__share">
        <p className="dashboard__code">
          {t.dashboard.joinCode} <code>{camp.joinCode}</code>
        </p>
        <p className="dashboard__slot-hint">{t.share.hint}</p>
        <p className="dashboard__members">{t.share.members(memberCount)}</p>
      </section>

      <section
        className={
          // Every camp has an everyday pool, so "nothing here yet" means no *income*,
          // not no pools.
          funded ? 'dashboard__slot dashboard__slot--filled' : 'dashboard__slot'
        }
      >
        <p className="dashboard__slot-title">{t.dashboard.receivedTotal}</p>
        {isLoading && !funded ? (
          <p className="dashboard__slot-hint">{t.app.loading}</p>
        ) : (
          <ReceivedTotals summaries={summaries} />
        )}
        <button className="dashboard__slot-link" type="button" onClick={onOpenIncome}>
          {t.dashboard.setUpIncome}
        </button>
      </section>

      <section
        className={burn.hasCurve ? 'dashboard__slot dashboard__slot--filled' : 'dashboard__slot'}
      >
        <p className="dashboard__slot-title">{t.burn.title}</p>
        {burn.hasCurve ? (
          <>
            <AllowedToday burn={burn} />
            <BurnChart burn={burn} todayIso={todayIso} />
          </>
        ) : (
          // Without the daily grant nothing per-day can be computed, so the camp is in an
          // unfinished-setup state rather than an empty one — say what is missing.
          <p className="dashboard__callout">{t.dashboard.setupCallout}</p>
        )}
      </section>

      <section
        className={
          funded || hasExpenses ? 'dashboard__slot dashboard__slot--filled' : 'dashboard__slot'
        }
      >
        <p className="dashboard__slot-title">{t.dashboard.spending}</p>
        {funded || hasExpenses ? (
          <>
            {!hasExpenses && <p className="dashboard__slot-hint">{t.dashboard.noReceipts}</p>}
            <PoolBars summaries={summaries} />
          </>
        ) : (
          <p className="dashboard__slot-hint">{t.dashboard.noIncome}</p>
        )}
        <button className="dashboard__slot-link" type="button" onClick={onOpenReceipts}>
          {t.dashboard.openReceipts}
        </button>
      </section>

      <section
        className={
          custody.statuses.length > 0 || custody.volunteerHeldCents > 0
            ? 'dashboard__slot dashboard__slot--filled'
            : 'dashboard__slot'
        }
      >
        <p className="dashboard__slot-title">{t.custody.title}</p>
        <CustodyStrip custody={custody} />
        <button className="dashboard__slot-link" type="button" onClick={onOpenMovements}>
          {t.custody.open}
        </button>
      </section>

      <section
        className={
          settlement.toReturnCents > 0
            ? 'dashboard__slot dashboard__slot--filled'
            : 'dashboard__slot'
        }
      >
        <p className="dashboard__slot-title">{t.settlement.toReturn}</p>
        <p className="dashboard__to-return">{format.euros(settlement.toReturnCents)}</p>
        <button className="dashboard__slot-link" type="button" onClick={onOpenSettlement}>
          {t.settlement.open}
        </button>
      </section>

      {error !== null && (
        <p className="dashboard__error" role="alert">
          {error}
        </p>
      )}

      <div className="dashboard__actions">
        <button className="dashboard__action" type="button" onClick={handleRename}>
          {t.dashboard.rename}
        </button>
        {isAdmin && (
          <button
            className="dashboard__action dashboard__action--danger"
            type="button"
            onClick={handleDelete}
          >
            {t.dashboard.delete}
          </button>
        )}
      </div>
    </div>
  )
}
