import './CampDashboard.css'
import { type ReactNode, useMemo, useState } from 'react'
import { useBackDismiss } from '../hooks/useBackDismiss'
import { useFormat, useT } from '../i18n'
import type { Burn } from '../lib/burn'
import { campStatus, isCampSetUp } from '../lib/camps'
import {
  type EntrySlot,
  parseHiddenSlots,
  serialiseHiddenSlots,
  toggleHiddenSlot,
} from '../lib/entrySlots'
import type { CustodyFocus, CustodyReading } from '../lib/movements'
import type { PoolSummary } from '../lib/pools'
import type { Camp } from '../lib/types'
import { AllowedToday } from './AllowedToday'
import { BurnChart } from './BurnChart'
import { BurnInfo } from './BurnInfo'
import { CampSetup } from './CampSetup'
import { DepositsStrip } from './DepositsStrip'
import { FeeStrip } from './FeeStrip'
import { PoolBars } from './PoolBars'
import { Screen } from './Screen'
import { SlotCard } from './SlotCard'
import { StatusPill } from './StatusPill'
import { Toast } from './Toast'

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
  /** Out-of-pocket spending no pool covers, as one figure for the card. Zero when there is
   *  none — which is also the common case, so the card shows its hint instead. */
  otherExpensesTotalCents: number
  /** Cash held rather than spent: the deposits and the participation fees. */
  custody: CustodyReading
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
  /** Opens the out-of-pocket expenses. */
  onOpenOtherExpenses: () => void
  onOpenReport: () => void
  onOpenSettings: () => void
  /** Store which entry cards this camp leaves out, as the whole serialised set. */
  onSetHiddenEntries: (hiddenEntries: string) => void
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
  otherExpensesTotalCents,
  custody,
  onBack,
  onOpenIncome,
  onChangeHolder,
  onOpenReceipts,
  onOpenMovements,
  onOpenOtherExpenses,
  onOpenReport,
  onOpenSettings,
  onSetHiddenEntries,
}: Props) {
  const t = useT()
  const format = useFormat()
  // Configuring the group is a mode, not a stored setting: it lasts as long as the visit.
  const [customising, setCustomising] = useState(false)
  // The back gesture should leave the mode rather than the camp — the same courtesy a row
  // menu gets, since both are a layer of choices over the screen underneath.
  useBackDismiss(customising, () => setCustomising(false))
  const hidden = useMemo(() => parseHiddenSlots(camp.hiddenEntries), [camp.hiddenEntries])

  // Every camp has an everyday pool, so "nothing here yet" means no *income*, not no pools.
  const funded = summaries.some((summary) => summary.sources.length > 0)
  // The curve only ever measures the everyday pool, so "left" has to come from that same
  // pool — the one whose bar further down shows the identical figure.
  const everydayRemainingCents =
    summaries.find((summary) => summary.pool.role === 'everyday')?.remainingCents ?? 0
  // Both setup answers are compulsory, so a camp missing either shows the checklist rather
  // than the hub — four blocks that cannot be trusted would hide the thing to do. Receipts
  // do not count: a receipt entered before the grant is unusual, and its "owed" marker is
  // meaningless until somebody holds the money anyway.
  const setUp = isCampSetUp(camp, funded)

  const header = (
    <>
      <header className="dashboard__header">
        <h2 className="screen__title">{camp.name}</h2>
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

      {error !== null && <Toast key={error} message={error} />}
    </>
  )

  // The checklist would be a lie for the first second — a funded camp still loading looks
  // exactly like an empty one, and telling somebody to enter income they already entered
  // is a wrong instruction rather than a flicker.
  if (!setUp && isLoading) {
    return (
      <Screen name="dashboard" back={{ label: t.dashboard.back, onClick: onBack }}>
        {header}
        <p className="slot-card__hint">{t.app.loading}</p>
      </Screen>
    )
  }

  if (!setUp) {
    return (
      <Screen name="dashboard" back={{ label: t.dashboard.back, onClick: onBack }}>
        {header}
        <CampSetup
          holder={camp.moneyHolder}
          funded={funded}
          summaries={summaries}
          onSaveHolder={onChangeHolder}
          onOpenIncome={onOpenIncome}
        />
      </Screen>
    )
  }

  // The hideable cards as data, so "which of these does this camp show?" is one filter
  // rather than three copies of the same condition around three blocks of JSX.
  const entrySlots: {
    slot: EntrySlot
    title: string
    /** Never drawn: what a screen reader reads in place of the chevron. */
    action: string
    onOpen: () => void
    filled: boolean
    body: ReactNode
  }[] = [
    {
      slot: 'deposits',
      title: t.custody.deposits.title,
      action: t.custody.deposits.open,
      onOpen: () => onOpenMovements('deposits'),
      filled: custody.statuses.length > 0,
      body: <DepositsStrip statuses={custody.statuses} />,
    },
    {
      slot: 'fee',
      title: t.custody.fee.title,
      action: t.custody.fee.open,
      onOpen: () => onOpenMovements('fee'),
      filled: custody.feeHeldCents > 0,
      body:
        custody.feeHeldCents > 0 ? (
          <FeeStrip heldCents={custody.feeHeldCents} count={custody.feeCount} />
        ) : (
          <p className="slot-card__hint">{t.custody.fee.empty}</p>
        ),
    },
    // Last of the four: it is the rarest of them, and the only one whose money never
    // belonged to the camp.
    {
      slot: 'other',
      title: t.otherExpenses.title,
      action: t.otherExpenses.open,
      onOpen: onOpenOtherExpenses,
      filled: otherExpensesTotalCents > 0,
      body:
        otherExpensesTotalCents > 0 ? (
          <p className="dashboard__other-total">
            <span>{t.otherExpenses.total}</span>
            <strong>{format.euros(otherExpensesTotalCents)}</strong>
          </p>
        ) : (
          <p className="slot-card__hint">{t.otherExpenses.empty}</p>
        ),
    },
  ]

  return (
    <Screen name="dashboard" back={{ label: t.dashboard.back, onClick: onBack }}>
      {header}

      <section className={burn.hasCurve ? 'slot-card slot-card--filled' : 'slot-card'}>
        <BurnInfo showToggle={burn.hasCurve} />
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

      {/* The blocks money is entered through, grouped away from the chart above and the
          report below, which only read it back. `aria-labelledby` makes the caption the
          group's accessible name, so the grouping is announced and not merely drawn. */}
      <section className="dashboard__group" aria-labelledby="dashboard-entries">
        <h3 className="dashboard__group-title">
          {/* The id sits on the caption's own text rather than the whole heading, so the
              group is announced as "Entries" and not "Entries Customise". */}
          <span id="dashboard-entries">{t.dashboard.entriesGroup}</span>
          <button
            className="dashboard__customise"
            type="button"
            aria-expanded={customising}
            onClick={() => setCustomising(!customising)}
          >
            {customising ? t.dashboard.doneCustomising : t.dashboard.customiseEntries}
          </button>
        </h3>

        {customising && <p className="dashboard__customise-hint">{t.dashboard.customiseHint}</p>}

        {/* No toggle: every camp writes receipts, and leaving this one fixed is what stops
            the group collapsing to a caption with nothing under it. */}
        <SlotCard
          title={t.dashboard.receipts}
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

        {/* A hidden card is drawn only while customising — which is also the only way back
            to a screen whose card is hidden, so nothing is ever locked away. */}
        {entrySlots
          .filter((entry) => customising || !hidden.includes(entry.slot))
          .map((entry) => {
            const isHidden = hidden.includes(entry.slot)
            return (
              <SlotCard
                key={entry.slot}
                title={entry.title}
                action={entry.action}
                onOpen={entry.onOpen}
                filled={entry.filled}
                toggle={
                  customising
                    ? {
                        hidden: isHidden,
                        label: isHidden ? t.dashboard.show : t.dashboard.hide,
                        name: isHidden
                          ? t.dashboard.showEntry(entry.title)
                          : t.dashboard.hideEntry(entry.title),
                        onToggle: () =>
                          onSetHiddenEntries(
                            serialiseHiddenSlots(toggleHiddenSlot(hidden, entry.slot)),
                          ),
                      }
                    : undefined
                }
              >
                {entry.body}
              </SlotCard>
            )
          })}
      </section>

      <SlotCard
        title={t.report.title}
        action={t.report.open}
        onOpen={onOpenReport}
        filled={funded || hasExpenses}
      >
        <p className="slot-card__hint">{t.report.hint}</p>
      </SlotCard>
    </Screen>
  )
}
