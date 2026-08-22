import './CampDashboard.css'
import { useFormat, useT } from '../i18n'
import type { Burn } from '../lib/burn'
import { campStatus, isCampSetUp } from '../lib/camps'
import type { CustodyFocus, CustodyReading } from '../lib/movements'
import type { PoolSummary } from '../lib/pools'
import type { Settlement } from '../lib/settlement'
import type { Camp } from '../lib/types'
import { AllowedToday } from './AllowedToday'
import { BurnChart } from './BurnChart'
import { CampSetup } from './CampSetup'
import { CashStrip } from './CashStrip'
import { DepositsStrip } from './DepositsStrip'
import { PoolBars } from './PoolBars'
import { SlotCard } from './SlotCard'
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
  /** Names the money holder from the setup checklist. A name only: the wallet can change
   *  hands but can never be put down. */
  onChangeHolder: (name: string) => void
  /** Opens the receipt list. A pool id opens it filtered to that pool; the dashboard
   *  always passes null, but the receipts screen itself still narrows by pool. */
  onOpenReceipts: (poolId: string | null) => void
  /** Opens the movements screen on one half of the custody money. */
  onOpenMovements: (focus: CustodyFocus) => void
  onOpenSettlement: () => void
  onOpenSettings: () => void
}

/**
 * The camp hub.
 */
export function CampDashboard({
  camp,
  summaries,
  burn,
  todayIso,
  isLoading,
  error,
  hasExpenses,
  custody,
  settlement,
  onBack,
  onOpenIncome,
  onChangeHolder,
  onOpenReceipts,
  onOpenMovements,
  onOpenSettlement,
  onOpenSettings,
}: Props) {
  const t = useT()
  const format = useFormat()

  // Every camp has an everyday pool, so "nothing here yet" means no *income*, not no pools.
  const funded = summaries.some((summary) => summary.sources.length > 0)
  // The curve only ever measures the everyday pool, so "left" has to come from that same
  // pool — the one whose bar further down shows the identical figure.
  const everydayRemainingCents =
    summaries.find((summary) => summary.pool.role === 'everyday')?.remainingCents ?? 0
  // Both setup answers are compulsory, so a camp missing either shows the checklist rather
  // than the hub — five blocks that cannot be trusted would hide the thing to do. Receipts
  // do not count: a receipt entered before the grant is unusual, and its "owed" marker is
  // meaningless until somebody holds the money anyway.
  const setUp = isCampSetUp(camp, funded)

  const header = (
    <>
      <button className="screen-back" type="button" onClick={onBack}>
        {t.dashboard.back}
      </button>

      <header className="dashboard__header">
        <h2 className="dashboard__name">{camp.name}</h2>
        <StatusPill status={campStatus(burn.window, todayIso)} />
        <button
          className="dashboard__settings"
          type="button"
          aria-label={t.dashboard.openSettings}
          onClick={onOpenSettings}
        >
          {/* The glyph carries no meaning a screen reader could use — the label does. */}
          <span aria-hidden="true">⚙</span>
        </button>
      </header>

      {error !== null && (
        <p className="dashboard__error" role="alert">
          {error}
        </p>
      )}
    </>
  )

  // The checklist would be a lie for the first second — a funded camp still loading looks
  // exactly like an empty one, and telling somebody to enter income they already entered
  // is a wrong instruction rather than a flicker.
  if (!setUp && isLoading) {
    return (
      <div className="dashboard">
        {header}
        <p className="slot-card__hint">{t.app.loading}</p>
      </div>
    )
  }

  if (!setUp) {
    return (
      <div className="dashboard">
        {header}
        <CampSetup
          holder={camp.moneyHolder}
          funded={funded}
          summaries={summaries}
          onSaveHolder={onChangeHolder}
          onOpenIncome={onOpenIncome}
        />
      </div>
    )
  }

  return (
    <div className="dashboard">
      {header}

      <section className={burn.hasCurve ? 'slot-card slot-card--filled' : 'slot-card'}>
        <p className="slot-card__title">{t.burn.title}</p>
        {burn.hasCurve ? (
          <>
            <AllowedToday burn={burn} remainingCents={everydayRemainingCents} />
            <BurnChart burn={burn} todayIso={todayIso} />
          </>
        ) : (
          // Without the daily grant nothing per-day can be computed, so the camp is in an
          // unfinished-setup state rather than an empty one — say what is missing.
          <p className="dashboard__callout">{t.dashboard.setupCallout}</p>
        )}
      </section>

      <SlotCard
        title={t.dashboard.spending}
        action={t.dashboard.openReceipts}
        onOpen={() => onOpenReceipts(null)}
        filled={funded || hasExpenses}
      >
        {funded || hasExpenses ? (
          <>
            {!hasExpenses && <p className="slot-card__hint">{t.dashboard.noReceipts}</p>}
            <PoolBars summaries={summaries} />
          </>
        ) : (
          <p className="slot-card__hint">{t.dashboard.noIncome}</p>
        )}
      </SlotCard>

      <SlotCard
        title={t.custody.deposits.title}
        action={t.custody.deposits.open}
        onOpen={() => onOpenMovements('deposits')}
        filled={custody.statuses.length > 0}
      >
        <DepositsStrip statuses={custody.statuses} />
      </SlotCard>

      <SlotCard
        title={t.custody.cash.title}
        action={t.custody.cash.open}
        onOpen={() => onOpenMovements('cash')}
        filled={custody.volunteerHeldCents > 0}
      >
        <CashStrip heldCents={custody.volunteerHeldCents} count={custody.volunteerCount} />
      </SlotCard>

      <SlotCard
        title={t.settlement.toReturn}
        action={t.settlement.open}
        onOpen={onOpenSettlement}
        filled={settlement.toReturnCents > 0}
      >
        <p className="dashboard__to-return">{format.euros(settlement.toReturnCents)}</p>
      </SlotCard>
    </div>
  )
}
