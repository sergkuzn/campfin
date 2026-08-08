import { useState } from 'react'
import './CampDashboard.css'
import { useFormat, useT } from '../i18n'
import type { Burn } from '../lib/burn'
import { campStatus } from '../lib/camps'
import type { SaveExpenseInput } from '../lib/expenses'
import type { CustodyFocus, CustodyReading } from '../lib/movements'
import type { PoolSummary } from '../lib/pools'
import type { Settlement } from '../lib/settlement'
import type { Camp } from '../lib/types'
import { AllowedToday } from './AllowedToday'
import { BurnChart } from './BurnChart'
import { CashStrip } from './CashStrip'
import { DepositsStrip } from './DepositsStrip'
import { PoolBars } from './PoolBars'
import { QuickExpenseDialog } from './QuickExpenseDialog'
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
  /** Writes one new receipt. The dashboard never touches the database itself. */
  onAddExpense: (input: SaveExpenseInput) => void
  onBack: () => void
  onOpenIncome: () => void
  onOpenReceipts: () => void
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
  onAddExpense,
  onBack,
  onOpenIncome,
  onOpenReceipts,
  onOpenMovements,
  onOpenSettlement,
  onOpenSettings,
}: Props) {
  const t = useT()
  const format = useFormat()

  // The id, not the pool: looking it up again each render means the open dialog follows a
  // rename and closes itself if the other leader deletes the pool mid-entry.
  const [quickAddPoolId, setQuickAddPoolId] = useState<string | null>(null)
  const quickAddPool =
    quickAddPoolId === null
      ? null
      : (summaries.find((s) => s.pool.id === quickAddPoolId)?.pool ?? null)

  // Every camp has an everyday pool, so "nothing here yet" means no *income*, not no pools.
  const funded = summaries.some((summary) => summary.sources.length > 0)
  // A camp with neither money nor receipts has nothing to show on any of the blocks below,
  // and five empty boxes hide the one thing that needs doing. Receipts count too: entering
  // one before the income is unusual, but it must not blank the screen it belongs on.
  const untouched = !funded && !hasExpenses

  const header = (
    <>
      <button className="dashboard__back" type="button" onClick={onBack}>
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

  // "Nothing here yet" would be a lie for the first second, and so would the first-step
  // screen — a funded camp still loading looks exactly like an empty one.
  if (untouched && isLoading) {
    return (
      <div className="dashboard">
        {header}
        <p className="dashboard__slot-hint">{t.app.loading}</p>
      </div>
    )
  }

  if (untouched) {
    return (
      <div className="dashboard">
        {header}
        <section className="dashboard__first-step">
          <p className="dashboard__slot-title">{t.dashboard.firstStepTitle}</p>
          <button className="dashboard__first-step-button" type="button" onClick={onOpenIncome}>
            {t.dashboard.firstStep}
          </button>
          <p className="dashboard__first-step-hint">{t.dashboard.firstStepHint}</p>
        </section>
      </div>
    )
  }

  return (
    <div className="dashboard">
      {header}

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
            <PoolBars summaries={summaries} onAdd={setQuickAddPoolId} />
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

      {/* One dialog for the screen, not one per bar: only one receipt is ever being typed,
          and a <dialog> per pool would put a draft's worth of state behind every button. */}
      <QuickExpenseDialog
        campId={camp.id}
        pool={quickAddPool}
        todayIso={todayIso}
        onSave={onAddExpense}
        onClose={() => setQuickAddPoolId(null)}
      />
    </div>
  )
}
