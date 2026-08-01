import './CampDashboard.css'
import { useFormat, useT } from '../i18n'
import type { Burn } from '../lib/burn'
import { campStatus } from '../lib/camps'
import type { CustodyFocus, CustodyReading } from '../lib/movements'
import type { PoolSummary } from '../lib/pools'
import type { Settlement } from '../lib/settlement'
import type { Camp } from '../lib/types'
import { AllowedToday } from './AllowedToday'
import { BurnChart } from './BurnChart'
import { CampSettingsMenu } from './CampSettingsMenu'
import { CashStrip } from './CashStrip'
import { DepositsStrip } from './DepositsStrip'
import { JoinCodeCard } from './JoinCodeCard'
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
  /** Opens the movements screen on one half of the custody money. */
  onOpenMovements: (focus: CustodyFocus) => void
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

  const funded = summaries.some((summary) => summary.sources.length > 0)

  return (
    <div className="dashboard">
      <button className="dashboard__back" type="button" onClick={onBack}>
        {t.dashboard.back}
      </button>

      <header className="dashboard__header">
        <h2 className="dashboard__name">{camp.name}</h2>
        <StatusPill status={campStatus(camp, todayIso)} />
        <CampSettingsMenu
          campName={camp.name}
          canDelete={isAdmin}
          onRename={(name) => onRename(camp.id, name)}
          onDelete={() => onDelete(camp.id)}
        />
      </header>

      <JoinCodeCard joinCode={camp.joinCode} memberCount={memberCount} />

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
          custody.statuses.length > 0
            ? 'dashboard__slot dashboard__slot--filled'
            : 'dashboard__slot'
        }
      >
        <p className="dashboard__slot-title">{t.custody.deposits.title}</p>
        <DepositsStrip statuses={custody.statuses} />
        <button
          className="dashboard__slot-link"
          type="button"
          onClick={() => onOpenMovements('deposits')}
        >
          {t.custody.deposits.open}
        </button>
      </section>

      <section
        className={
          custody.volunteerHeldCents > 0
            ? 'dashboard__slot dashboard__slot--filled'
            : 'dashboard__slot'
        }
      >
        <p className="dashboard__slot-title">{t.custody.cash.title}</p>
        <CashStrip heldCents={custody.volunteerHeldCents} count={custody.volunteerCount} />
        <button
          className="dashboard__slot-link"
          type="button"
          onClick={() => onOpenMovements('cash')}
        >
          {t.custody.cash.open}
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
    </div>
  )
}
