import { useMemo, useState } from 'react'
import { downloadCsv } from '../db/download'
import { useAccount } from '../hooks/useAccount'
import { useAdmin } from '../hooks/useAdmin'
import { useCamps } from '../hooks/useCamps'
import { useExpenses } from '../hooks/useExpenses'
import { useIncome } from '../hooks/useIncome'
import { useMovements } from '../hooks/useMovements'
import { useOtherExpenses } from '../hooks/useOtherExpenses'
import { usePfand } from '../hooks/usePfand'
import { useRequestAccess } from '../hooks/useRequestAccess'
import { useScrollToTop } from '../hooks/useScrollToTop'
import type { Session } from '../hooks/useSession'
import { useViewHistory } from '../hooks/useViewHistory'
import { computeBurn, emptyBurn } from '../lib/burn'
import { campWindow } from '../lib/camps'
import { todayIso } from '../lib/dates'
import { exportFileName } from '../lib/exportFile'
import { isCampAdmin, memberCount } from '../lib/members'
import { type CustodyFocus, custodyReading } from '../lib/movements'
import { otherExpensesTotalCents } from '../lib/otherExpenses'
import { pfandBalances, pfandLedger } from '../lib/pfand'
import { depositPools, everydayPool, summarisePools } from '../lib/pools'
import { buildReport } from '../lib/report'
import { computeSettlement } from '../lib/settlement'
import { AdminScreen } from './AdminScreen'
import { CampDashboard } from './CampDashboard'
import { CampList } from './CampList'
import { CampSettingsScreen } from './CampSettingsScreen'
import { FinancialReport } from './FinancialReport'
import { IncomeSetup } from './IncomeSetup'
import { MovementsScreen } from './MovementsScreen'
import { OtherExpensesScreen } from './OtherExpensesScreen'
import { PfandScreen } from './PfandScreen'
import { ReceiptsScreen } from './ReceiptsScreen'

/**
 * Every screen, no router. `View` is a discriminated union rather than two independent
 * pieces of state: `campId` exists only on the screens that have a camp open, so "income
 * screen with no camp" cannot be represented at all. A real router arrives only if we need
 * URLs.
 */
type View =
  | { screen: 'list' }
  | { screen: 'admin' }
  | { screen: 'dashboard'; campId: string }
  | { screen: 'income'; campId: string }
  // `poolId` is where the receipt list *opens*, not a lasting setting: the screen seeds its
  // filter from it once and owns the chips from then on.
  | { screen: 'receipts'; campId: string; poolId: string | null }
  | { screen: 'movements'; campId: string; focus: CustodyFocus }
  | { screen: 'other'; campId: string }
  | { screen: 'pfand'; campId: string }
  | { screen: 'report'; campId: string }
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
  // What this account may do app-wide, as opposed to what it may do inside one camp.
  const { access, isLoading: accessLoading } = useAccount(session.userId)
  // Tell the admins once, in the background, that this account is waiting on them. The
  // `!accessLoading` matters: an unresolved query also has no account, and without it every
  // already-granted leader would announce themselves on every cold start.
  useRequestAccess(session.userId, !accessLoading && access.account === null)
  // Admin only, and off by default: your own camps are the ones you came here for, so
  // everyone else's stay behind a switch rather than burying them.
  const [showAllCamps, setShowAllCamps] = useState(false)
  const admin = useAdmin(access.isAdmin)

  const {
    camps,
    memberships,
    blocks: campBlocks,
    isLoading,
    error,
    createCamp,
    renameCamp,
    setMoneyHolder,
    setHiddenEntries,
    openViewLink,
    setViewUntil,
    closeViewLink,
    deleteCamp,
    clearError,
  } = useCamps(session.userId, access.isAdmin && showAllCamps)
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
  // stale state to clean up. `'campId' in view` narrows the union to the screens that have
  // one, so adding a camp-less screen never needs this line touched again.
  const openCamp = 'campId' in view ? camps.find((c) => c.id === view.campId) : undefined
  const openCampId = openCamp?.id ?? ''

  // One query per namespace an open camp needs: passing '' skips them entirely while the
  // list is showing.
  const income = useIncome(openCampId)
  const expenses = useExpenses(openCampId)
  const movements = useMovements(openCampId)
  const other = useOtherExpenses(openCampId)
  const pfand = usePfand(openCampId)
  // Whether out-of-pocket spending counts towards the report's totals. It lives here rather
  // than on the report screen because it is an input to `buildReport` below — a copy down
  // there could disagree with the numbers it is drawn beside. On by default: the money was
  // spent, and hiding it is the deliberate act.
  const [includeOther, setIncludeOther] = useState(true)

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

  // The pfand ledger, computed once for the dashboard card, the pfand screen and the report:
  // three places quoting the same balance, so they read it from one computation rather than
  // three.
  const pfandTxns = useMemo(
    () => pfandLedger(expenses.expenses, pfand.entries, openCamp?.moneyHolder),
    [expenses.expenses, pfand.entries, openCamp],
  )
  const balances = useMemo(() => pfandBalances(pfandTxns), [pfandTxns])

  // The camp's span, for the receipt date field: highlights those days and asks before
  // saving a receipt outside them.
  const campSpan = useMemo(() => campWindow(blocks), [blocks])

  // What goes back at the end, floored per pool. Derived from the same summaries as the
  // bars, so the dashboard headline and the report behind it cannot quote different totals.
  const settlement = useMemo(
    () =>
      computeSettlement({
        summaries,
        blocks,
        expenses: expenses.expenses,
        movements: movements.movements,
        otherExpenses: other.otherExpenses,
        pfandEntries: pfand.entries,
        moneyHolder: openCamp?.moneyHolder,
      }),
    [
      summaries,
      blocks,
      expenses.expenses,
      movements.movements,
      other.otherExpenses,
      pfand.entries,
      openCamp,
    ],
  )

  // The same figures read as a statement: income, expenses, and the difference between
  // them. Separate from the settlement because the two answer different questions — this
  // one balances to the cent, that one floors each pool before transferring anything back.
  const report = useMemo(
    () =>
      buildReport({
        summaries,
        blocks,
        expenses: expenses.expenses,
        movements: movements.movements,
        otherExpenses: other.otherExpenses,
        includeOther,
      }),
    [summaries, blocks, expenses.expenses, movements.movements, other.otherExpenses, includeOther],
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

  // The report builds the CSV text, because the column labels are its business; the
  // filename and the download are the app's.
  const handleExportCsv = (text: string) => {
    if (openCamp === undefined) return
    downloadCsv(exportFileName(openCamp, new Date().toISOString(), 'csv'), text)
  }

  if (view.screen === 'admin') {
    return (
      <AdminScreen
        admin={admin}
        onBack={goBack}
        onOpenCamp={(campId) => {
          // Another leader's camp is only in `camps` while the switch is on, so opening one
          // from here turns it on: the dashboard reads the camp out of that same list.
          setShowAllCamps(true)
          navigate({ screen: 'dashboard', campId })
        }}
      />
    )
  }

  if (openCamp === undefined) {
    return (
      <CampList
        camps={camps}
        blocks={campBlocks}
        userId={session.userId}
        access={access}
        showAllCamps={showAllCamps}
        waitingCount={admin.waiting.length}
        isLoading={isLoading}
        error={error}
        onOpen={handleOpen}
        onCreate={handleCreate}
        onToggleAllCamps={setShowAllCamps}
        onOpenAdmin={() => navigate({ screen: 'admin' })}
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
        onOpenPfand={() => navigate({ screen: 'pfand', campId: openCamp.id })}
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
        campWindow={campSpan}
        onBack={goBack}
      />
    )
  }

  if (view.screen === 'other') {
    return (
      <OtherExpensesScreen
        campId={openCamp.id}
        moneyHolder={openCamp.moneyHolder}
        campWindow={campSpan}
        otherExpenses={other}
        onBack={goBack}
      />
    )
  }

  if (view.screen === 'pfand') {
    return (
      <PfandScreen
        campId={openCamp.id}
        pfand={pfand}
        txns={pfandTxns}
        balances={balances}
        moneyHolder={openCamp.moneyHolder}
        campWindow={campSpan}
        onBack={goBack}
      />
    )
  }

  if (view.screen === 'report') {
    return (
      <FinancialReport
        camp={openCamp}
        report={report}
        settlement={settlement}
        expenses={expenses.expenses}
        summaries={summaries}
        hasOtherExpenses={other.otherExpenses.length > 0}
        includeOther={includeOther}
        onIncludeOtherChange={setIncludeOther}
        onBack={goBack}
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
        campWindow={campSpan}
        isAdmin={isCampAdmin(memberships, openCamp.id, session.userId)}
        isLoading={income.isLoading}
        error={error ?? income.error}
        onBack={goBack}
        onOpenIncome={() => navigate({ screen: 'income', campId: openCamp.id })}
        expenses={expenses.expenses}
        onRename={(name) => renameCamp(openCamp.id, name)}
        onChangeHolder={(name: string) => setMoneyHolder(openCamp.id, name)}
        onOpenViewLink={(lastDayIso) => openViewLink(openCamp.id, lastDayIso)}
        onSetViewUntil={(lastDayIso) => setViewUntil(openCamp.id, lastDayIso)}
        onCloseViewLink={() => closeViewLink(openCamp.id)}
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
      error={
        error ?? income.error ?? expenses.error ?? movements.error ?? other.error ?? pfand.error
      }
      hasExpenses={expenses.expenses.length > 0}
      otherExpensesTotalCents={otherExpensesTotalCents(other.otherExpenses)}
      custody={custody}
      onBack={goBack}
      onOpenIncome={() => navigate({ screen: 'income', campId: openCamp.id })}
      onChangeHolder={(name: string) => setMoneyHolder(openCamp.id, name)}
      onOpenReceipts={(poolId) => navigate({ screen: 'receipts', campId: openCamp.id, poolId })}
      onOpenMovements={(focus) => navigate({ screen: 'movements', campId: openCamp.id, focus })}
      onOpenOtherExpenses={() => navigate({ screen: 'other', campId: openCamp.id })}
      onOpenReport={() => navigate({ screen: 'report', campId: openCamp.id })}
      onOpenSettings={() => navigate({ screen: 'settings', campId: openCamp.id })}
      onSetHiddenEntries={(hiddenEntries) => setHiddenEntries(openCamp.id, hiddenEntries)}
    />
  )
}
