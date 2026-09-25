import { useMemo } from 'react'
import './ViewerApp.css'
import { useExpenses } from '../hooks/useExpenses'
import { useIncome } from '../hooks/useIncome'
import { usePfand } from '../hooks/usePfand'
import { useScrollToTop } from '../hooks/useScrollToTop'
import { useViewCamp } from '../hooks/useViewCamp'
import { useViewHistory } from '../hooks/useViewHistory'
import { useT } from '../i18n'
import { computeBurn } from '../lib/burn'
import { campStatus, campWindow } from '../lib/camps'
import { todayIso } from '../lib/dates'
import { pfandBalances, pfandLedger } from '../lib/pfand'
import { everydayPool, summarisePools } from '../lib/pools'
import type { Camp } from '../lib/types'
import { isViewCode } from '../lib/viewAccess'
import { AllowedToday } from './AllowedToday'
import { BurnChart } from './BurnChart'
import { BurnInfo } from './BurnInfo'
import { PfandScreen } from './PfandScreen'
import { PoolBars } from './PoolBars'
import { ReceiptsScreen } from './ReceiptsScreen'
import { Screen } from './Screen'
import { SlotCard } from './SlotCard'
import { StatusPill } from './StatusPill'

type Props = {
  /** The code from the link, as it arrived — checked here before anything is asked of the
   *  server. */
  viewCode: string
}

/**
 * The participant view: what a view link opens, in place of the whole signed-in app.
 *
 * It sits *outside* the sign-in gate, because participants never sign in — the link's code
 * is their permission, checked by the server on every query. Nothing here writes: the
 * screens run in read-only mode, and the permission rules would refuse a write anyway.
 */
export function ViewerApp({ viewCode }: Props) {
  // A mangled link is caught before the lookup, so it never reaches the server at all.
  if (!isViewCode(viewCode)) return <ViewerClosed />

  return <ViewerLookup viewCode={viewCode} />
}

/** Split from `ViewerApp` so the query hook below is never called conditionally — the
 *  shape check above returns early, and hooks may not sit behind an early return. */
function ViewerLookup({ viewCode }: Props) {
  const t = useT()
  const lookup = useViewCamp(viewCode)

  switch (lookup.status) {
    case 'loading':
      return <p className="app__loading">{t.app.loading}</p>
    case 'error':
      return (
        <p className="app__error" role="alert">
          {lookup.message}
        </p>
      )
    case 'notFound':
      return <ViewerClosed />
    case 'found':
      return <ViewerCamp camp={lookup.camp} viewCode={viewCode} />
  }
}

/** One message for a wrong link and a run-out one: the server answers both with no rows,
 *  and to a participant they mean the same thing — ask a leader. */
function ViewerClosed() {
  const t = useT()
  return (
    <Screen name="viewer">
      <h2 className="screen__title">{t.viewer.closedTitle}</h2>
      <p className="slot-card__hint">{t.viewer.closedHint}</p>
    </Screen>
  )
}

/** The three screens a participant can reach. A union of its own rather than the signed-in
 *  app's `View`: the camp is fixed by the link, so no screen here carries a `campId`. */
type ViewerView = { screen: 'overview' } | { screen: 'receipts' } | { screen: 'pfand' }

function ViewerCamp({ camp, viewCode }: { camp: Camp; viewCode: string }) {
  const t = useT()
  const [view, navigate, goBack] = useViewHistory<ViewerView>({ screen: 'overview' })
  useScrollToTop(view)

  // The same hooks the leaders' screens use, each told to read through the link's code.
  const income = useIncome(camp.id, viewCode)
  const expenses = useExpenses(camp.id, viewCode)
  const pfand = usePfand(camp.id, viewCode)

  const { pools, sources, blocks } = income
  const summaries = useMemo(
    () => summarisePools(pools, sources, blocks, expenses.expenses),
    [pools, sources, blocks, expenses.expenses],
  )
  const campSpan = useMemo(() => campWindow(blocks), [blocks])
  const pfandTxns = useMemo(
    () => pfandLedger(expenses.expenses, pfand.entries, camp.moneyHolder),
    [expenses.expenses, pfand.entries, camp.moneyHolder],
  )
  const balances = useMemo(() => pfandBalances(pfandTxns), [pfandTxns])

  const today = todayIso()
  const burn = useMemo(
    () =>
      computeBurn({
        everydayPoolId: everydayPool(pools, camp.id)?.id ?? '',
        sources,
        blocks,
        expenses: expenses.expenses,
        todayIso: today,
      }),
    [camp.id, pools, sources, blocks, expenses.expenses, today],
  )

  if (view.screen === 'receipts') {
    return (
      <ReceiptsScreen
        campId={camp.id}
        moneyHolder={camp.moneyHolder}
        campWindow={campSpan}
        expenses={expenses}
        summaries={summaries}
        focusPoolId={null}
        readOnly
        onBack={goBack}
        onOpenPfand={() => navigate({ screen: 'pfand' })}
      />
    )
  }

  if (view.screen === 'pfand') {
    return (
      <PfandScreen
        campId={camp.id}
        pfand={pfand}
        txns={pfandTxns}
        balances={balances}
        moneyHolder={camp.moneyHolder}
        campWindow={campSpan}
        readOnly
        onBack={goBack}
      />
    )
  }

  const everydayRemainingCents =
    summaries.find((summary) => summary.pool.role === 'everyday')?.remainingCents ?? 0
  const hasExpenses = expenses.expenses.length > 0

  // No back button: this is the root of the link, and back from here leaves the page.
  return (
    <Screen name="viewer">
      <header className="viewer__header">
        <h2 className="screen__title">{camp.name}</h2>
        <StatusPill status={campStatus(burn.window, today)} />
      </header>
      <p className="viewer__note">{t.viewer.readOnlyNote}</p>

      <section className={burn.hasCurve ? 'slot-card slot-card--filled' : 'slot-card'}>
        <BurnInfo showToggle={burn.hasCurve} />
        {burn.hasCurve ? (
          <>
            <AllowedToday burn={burn} remainingCents={everydayRemainingCents} />
            <BurnChart burn={burn} todayIso={today} />
          </>
        ) : (
          <p className="slot-card__hint">{income.isLoading ? t.app.loading : t.viewer.noChart}</p>
        )}
      </section>

      <SlotCard
        title={t.dashboard.receipts}
        action={t.dashboard.openReceipts}
        onOpen={() => navigate({ screen: 'receipts' })}
        filled={hasExpenses}
      >
        {!hasExpenses && <p className="slot-card__hint">{t.dashboard.noReceipts}</p>}
        <PoolBars summaries={summaries} />
      </SlotCard>
    </Screen>
  )
}
