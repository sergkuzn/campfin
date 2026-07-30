import { useMemo, useState } from 'react'
import { downloadJson } from '../db/download'
import { useCamps } from '../hooks/useCamps'
import { useExpenses } from '../hooks/useExpenses'
import { useIncome } from '../hooks/useIncome'
import type { Session } from '../hooks/useSession'
import { computeBurn, emptyBurn } from '../lib/burn'
import { todayIso } from '../lib/dates'
import { buildCampExport, exportFileName } from '../lib/exportJson'
import { isCampAdmin, memberCount } from '../lib/members'
import { everydayPool, summarisePools } from '../lib/pools'
import { CampDashboard } from './CampDashboard'
import { CampList } from './CampList'
import { IncomeSetup } from './IncomeSetup'
import { ReceiptsScreen } from './ReceiptsScreen'

/**
 * Three screens, no router. `View` is a discriminated union rather than two independent
 * pieces of state: `campId` exists only on the screens that have a camp open, so "income
 * screen with no camp" cannot be represented at all. A real router arrives only if we need
 * URLs.
 */
type View =
  | { screen: 'list' }
  | { screen: 'dashboard'; campId: string }
  | { screen: 'income'; campId: string }
  | { screen: 'receipts'; campId: string }

type Props = {
  session: Session
}

/**
 * Everything behind the sign-in gate. Split from `App` so the data hooks below are only
 * ever called with a real user id — hooks cannot be called conditionally, and a query that
 * has to cope with "no user yet" would leak that state into every screen.
 */
export function SignedInApp({ session }: Props) {
  const { camps, memberships, isLoading, error, createCamp, renameCamp, deleteCamp, clearError } =
    useCamps(session.userId)
  const [view, setView] = useState<View>({ screen: 'list' })

  // `find` returns `Camp | undefined`; if the open camp was just deleted — by us, or by the
  // other leader mid-sync — we fall back to the list automatically, with no effect and no
  // stale state to clean up.
  const openCamp = view.screen === 'list' ? undefined : camps.find((c) => c.id === view.campId)
  const openCampId = openCamp?.id ?? ''

  // Two queries per open camp: passing '' skips them entirely while the list is showing.
  const income = useIncome(openCampId)
  const expenses = useExpenses(openCampId)

  const { pools, sources, blocks } = income
  // The one place income and spending meet: every pool total on every screen comes from
  // here, so a receipt shows up in the bars, the totals and the settlement at once.
  const summaries = useMemo(
    () => summarisePools(pools, sources, blocks, expenses.expenses),
    [pools, sources, blocks, expenses.expenses],
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
            camp: openCamp,
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
    setView({ screen: 'dashboard', campId: camp.id }) // jump straight into the new camp
    return true
  }

  // Clear any pending error when switching screens, so a rejected create or rename on one
  // screen doesn't linger on the next.
  const handleOpen = (campId: string) => {
    clearError()
    setView({ screen: 'dashboard', campId })
  }

  const handleBackToList = () => {
    clearError()
    setView({ screen: 'list' })
  }

  const handleDelete = (campId: string) => {
    deleteCamp(campId)
    setView({ screen: 'list' })
  }

  const handleExport = () => {
    if (openCamp === undefined) return
    const exportedAt = new Date().toISOString()
    const dump = buildCampExport(
      openCamp,
      { pools, sources, blocks },
      expenses.expenses,
      exportedAt,
    )
    downloadJson(exportFileName(openCamp, exportedAt), JSON.stringify(dump, null, 2))
  }

  if (openCamp === undefined) {
    return (
      <CampList
        camps={camps}
        userId={session.userId}
        isLoading={isLoading}
        error={error}
        onOpen={handleOpen}
        onCreate={handleCreate}
      />
    )
  }

  if (view.screen === 'receipts') {
    return (
      <ReceiptsScreen
        campId={openCamp.id}
        expenses={expenses}
        summaries={summaries}
        onBack={() => setView({ screen: 'dashboard', campId: openCamp.id })}
      />
    )
  }

  if (view.screen === 'income') {
    return (
      <IncomeSetup
        campId={openCamp.id}
        income={income}
        onBack={() => setView({ screen: 'dashboard', campId: openCamp.id })}
      />
    )
  }

  return (
    <CampDashboard
      camp={openCamp}
      summaries={summaries}
      burn={burn}
      todayIso={today}
      memberCount={memberCount(memberships, openCamp.id)}
      isAdmin={isCampAdmin(memberships, openCamp.id, session.userId)}
      isLoading={income.isLoading}
      error={error ?? income.error ?? expenses.error}
      hasExpenses={expenses.expenses.length > 0}
      onBack={handleBackToList}
      onOpenIncome={() => setView({ screen: 'income', campId: openCamp.id })}
      onOpenReceipts={() => setView({ screen: 'receipts', campId: openCamp.id })}
      onRename={renameCamp}
      onDelete={handleDelete}
      onExport={handleExport}
    />
  )
}
