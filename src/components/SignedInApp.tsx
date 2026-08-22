import { useMemo } from 'react'
import { downloadCsv, downloadJson } from '../db/download'
import { useCamps } from '../hooks/useCamps'
import { useExpenses } from '../hooks/useExpenses'
import { useIncome } from '../hooks/useIncome'
import { useMovements } from '../hooks/useMovements'
import { useScrollToTop } from '../hooks/useScrollToTop'
import type { Session } from '../hooks/useSession'
import { useViewHistory } from '../hooks/useViewHistory'
import { computeBurn, emptyBurn } from '../lib/burn'
import { campWindow } from '../lib/camps'
import { todayIso } from '../lib/dates'
import { buildCampExport, exportFileName } from '../lib/exportJson'
import { isCampAdmin, memberCount } from '../lib/members'
import { type CustodyFocus, custodyReading } from '../lib/movements'
import { depositPools, everydayPool, summarisePools } from '../lib/pools'
import { computeSettlement } from '../lib/settlement'
import { CampDashboard } from './CampDashboard'
import { CampList } from './CampList'
import { CampSettingsScreen } from './CampSettingsScreen'
import { IncomeSetup } from './IncomeSetup'
import { MovementsScreen } from './MovementsScreen'
import { ReceiptsScreen } from './ReceiptsScreen'
import { SettlementSheet } from './SettlementSheet'

/**
 * Every screen, no router. `View` is a discriminated union rather than two independent
 * pieces of state: `campId` exists only on the screens that have a camp open, so "income
 * screen with no camp" cannot be represented at all. A real router arrives only if we need
 * URLs.
 */
type View =
  | { screen: 'list' }
  | { screen: 'dashboard'; campId: string }
  | { screen: 'income'; campId: string }
  // `poolId` is where the receipt list *opens*, not a lasting setting: the screen seeds its
  // filter from it once and owns the chips from then on.
  | { screen: 'receipts'; campId: string; poolId: string | null }
  | { screen: 'movements'; campId: string; focus: CustodyFocus }
  | { screen: 'settlement'; campId: string }
  | { screen: 'settings'; campId: string }

type Props = {
  session: Session
}

/**
 * Everything behind the sign-in gate. Split from `App` so the data hooks below are only
 * ever called with a real user id — hooks cannot be called conditionally, and a query that
 * has to cope with "no user yet" would leak that state into every screen.
 */
export function SignedInApp({ session }: Props) {
  const {
    camps,
    memberships,
    blocks: campBlocks,
    isLoading,
    error,
    createCamp,
    importCamp,
    renameCamp,
    setMoneyHolder,
    deleteCamp,
    clearError,
  } = useCamps(session.userId)
  // Backed by session history, so the phone's own back gesture steps up a screen exactly
  // as the ← buttons do. `navigate` replaces `setView` and takes the same values; the
  // callback clears any pending error whichever way the screen was left, so a rejected
  // create or rename cannot linger on the next one.
  const [view, navigate, goBack] = useViewHistory<View>({ screen: 'list' }, clearError)

  // No router means no automatic scroll reset: without this, opening a pool's receipts from
  // a bar low on the dashboard would show that screen already scrolled down.
  useScrollToTop(view)

  // `find` returns `Camp | undefined`; if the open camp was just deleted — by us, or by the
  // other leader mid-sync — we fall back to the list automatically, with no effect and no
  // stale state to clean up.
  const openCamp = view.screen === 'list' ? undefined : camps.find((c) => c.id === view.campId)
  const openCampId = openCamp?.id ?? ''

  // Three queries per open camp: passing '' skips them entirely while the list is showing.
  const income = useIncome(openCampId)
  const expenses = useExpenses(openCampId)
  const movements = useMovements(openCampId)

  const { pools, sources, blocks } = income
  // The one place income and spending meet: every pool total on every screen comes from
  // here, so a receipt shows up in the bars, the totals and the settlement at once.
  const summaries = useMemo(
    () => summarisePools(pools, sources, blocks, expenses.expenses),
    [pools, sources, blocks, expenses.expenses],
  )

  // Custody money, computed in one place for the dashboard strip and the movements screen:
  // two computations of the same deposits could disagree mid-sync.
  const custody = useMemo(
    () => custodyReading(summaries, movements.movements),
    [summaries, movements.movements],
  )
  const deposits = useMemo(() => depositPools(summaries), [summaries])

  // The camp's span, for the receipt date field: highlights those days and asks before
  // saving a receipt outside them.
  const campSpan = useMemo(() => campWindow(blocks), [blocks])

  // What goes back at the end. Derived from the same summaries as the bars, so the
  // dashboard headline and the sheet behind it can never quote different totals.
  const settlement = useMemo(
    () =>
      computeSettlement({
        summaries,
        blocks,
        expenses: expenses.expenses,
        movements: movements.movements,
        moneyHolder: openCamp?.moneyHolder,
      }),
    [summaries, blocks, expenses.expenses, movements.movements, openCamp],
  )

  // One clock read per render, shared by the status pill, the burn math and the chart's
  // "today" line. A camp left open across midnight keeps yesterday's date until something
  // re-renders — acceptable for a tool used at camp, and cheaper than a timer.
  const today = todayIso()

  // `computeBurn` walks every camp day and every receipt, so it is memoised on exactly the
  // rows it reads: without this, typing in an unrelated field would rebuild the chart data
  // and Recharts would re-animate on every keystroke.
  const burn = useMemo(
    () =>
      openCamp === undefined
        ? emptyBurn
        : computeBurn({
            everydayPoolId: everydayPool(pools, openCamp.id)?.id ?? '',
            sources,
            blocks,
            expenses: expenses.expenses,
            todayIso: today,
          }),
    [openCamp, pools, sources, blocks, expenses.expenses, today],
  )

  // createCamp returns null when the name is taken; only navigate on success.
  // Returning the outcome lets the form keep the typed name so it can be corrected.
  const handleCreate = (name: string): boolean => {
    const camp = createCamp(name)
    if (camp === null) return false
    navigate({ screen: 'dashboard', campId: camp.id }) // jump straight into the new camp
    return true
  }

  const handleOpen = (campId: string) => {
    navigate({ screen: 'dashboard', campId })
  }

  const handleDelete = (campId: string) => {
    deleteCamp(campId)
    // 'replace', not a push: the camp is gone, so its screen must not stay in the history
    // stack for a back press to return to.
    navigate({ screen: 'list' }, 'replace')
  }

  const handleExportJson = () => {
    if (openCamp === undefined) return
    const exportedAt = new Date().toISOString()
    const dump = buildCampExport(
      openCamp,
      { pools, sources, blocks },
      expenses.expenses,
      movements.movements,
      exportedAt,
    )
    downloadJson(exportFileName(openCamp, exportedAt, 'json'), JSON.stringify(dump, null, 2))
  }

  // The sheet builds the CSV text, because the column labels are its business; the
  // filename and the download are the app's.
  const handleExportCsv = (text: string) => {
    if (openCamp === undefined) return
    downloadCsv(exportFileName(openCamp, new Date().toISOString(), 'csv'), text)
  }

  const handleImport = (text: string): boolean => {
    const camp = importCamp(text)
    // Null means the file was refused; the reason is already in `error` on the list.
    if (camp === null) return false
    navigate({ screen: 'dashboard', campId: camp.id })
    return true
  }

  if (openCamp === undefined) {
    return (
      <CampList
        camps={camps}
        blocks={campBlocks}
        userId={session.userId}
        isLoading={isLoading}
        error={error}
        onOpen={handleOpen}
        onCreate={handleCreate}
        onImport={handleImport}
      />
    )
  }

  if (view.screen === 'receipts') {
    return (
      <ReceiptsScreen
        campId={openCamp.id}
        moneyHolder={openCamp.moneyHolder}
        campWindow={campSpan}
        expenses={expenses}
        summaries={summaries}
        focusPoolId={view.poolId}
        onBack={goBack}
      />
    )
  }

  if (view.screen === 'movements') {
    return (
      <MovementsScreen
        campId={openCamp.id}
        focus={view.focus}
        movements={movements}
        deposits={deposits}
        custody={custody}
        onBack={goBack}
      />
    )
  }

  if (view.screen === 'settlement') {
    return (
      <SettlementSheet
        camp={openCamp}
        settlement={settlement}
        expenses={expenses.expenses}
        summaries={summaries}
        onBack={goBack}
        onExportJson={handleExportJson}
        onExportCsv={handleExportCsv}
      />
    )
  }

  if (view.screen === 'settings') {
    return (
      <CampSettingsScreen
        camp={openCamp}
        summaries={summaries}
        memberCount={memberCount(memberships, openCamp.id)}
        isAdmin={isCampAdmin(memberships, openCamp.id, session.userId)}
        isLoading={income.isLoading}
        error={error ?? income.error}
        onBack={goBack}
        onOpenIncome={() => navigate({ screen: 'income', campId: openCamp.id })}
        expenses={expenses.expenses}
        onRename={(name) => renameCamp(openCamp.id, name)}
        onChangeHolder={(name: string) => setMoneyHolder(openCamp.id, name)}
        onDelete={() => handleDelete(openCamp.id)}
      />
    )
  }

  if (view.screen === 'income') {
    return <IncomeSetup campId={openCamp.id} income={income} onBack={goBack} />
  }

  return (
    <CampDashboard
      camp={openCamp}
      summaries={summaries}
      burn={burn}
      todayIso={today}
      isLoading={income.isLoading}
      error={error ?? income.error ?? expenses.error ?? movements.error}
      hasExpenses={expenses.expenses.length > 0}
      custody={custody}
      settlement={settlement}
      onBack={goBack}
      onOpenIncome={() => navigate({ screen: 'income', campId: openCamp.id })}
      onChangeHolder={(name: string) => setMoneyHolder(openCamp.id, name)}
      onOpenReceipts={(poolId) => navigate({ screen: 'receipts', campId: openCamp.id, poolId })}
      onOpenMovements={(focus) => navigate({ screen: 'movements', campId: openCamp.id, focus })}
      onOpenSettlement={() => navigate({ screen: 'settlement', campId: openCamp.id })}
      onOpenSettings={() => navigate({ screen: 'settings', campId: openCamp.id })}
    />
  )
}
