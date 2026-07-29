import { useMemo, useState } from 'react'
import './App.css'
import { CampDashboard } from './components/CampDashboard'
import { CampList } from './components/CampList'
import { IncomeSetup } from './components/IncomeSetup'
import { useCamps } from './hooks/useCamps'
import { useIncome } from './hooks/useIncome'
import { campSlice } from './lib/income'
import { summarisePools } from './lib/pools'

/**
 * Three screens, no router. `View` is a discriminated union rather than two
 * independent pieces of state: `campId` exists only on the screens that have a camp
 * open, so "income screen with no camp" cannot be represented at all. A real router
 * arrives only if we need URLs.
 */
type View =
  | { screen: 'list' }
  | { screen: 'dashboard'; campId: string }
  | { screen: 'income'; campId: string }

export default function App() {
  const { camps, error, createCamp, renameCamp, deleteCamp, clearError } = useCamps()
  // One hook instance for the whole app: a single source of truth in memory and a
  // single persistence effect. Per-screen instances would drift and fight over the keys.
  const income = useIncome()
  const [view, setView] = useState<View>({ screen: 'list' })

  // `find` returns `Camp | undefined`; if the open camp was just deleted we fall back
  // to the list automatically, with no effect and no stale state to clean up.
  const openCamp = view.screen === 'list' ? undefined : camps.find((c) => c.id === view.campId)

  const { pools, sources, blocks } = income
  const openCampId = openCamp?.id ?? ''
  // The dashboard renders only its own camp's rows. Destructuring the arrays first
  // keeps the dependency list honest: they change identity exactly when data changes.
  // Expenses are [] until milestone 4 — received money is independent of spending.
  const openCampPools = useMemo(() => {
    const slice = campSlice({ pools, sources, blocks }, openCampId)
    return summarisePools(slice.pools, slice.sources, slice.blocks, [])
  }, [pools, sources, blocks, openCampId])

  // createCamp returns null when the name is taken; only navigate on success.
  // Returning the outcome lets the form keep the typed name so it can be corrected.
  const handleCreate = (name: string): boolean => {
    const camp = createCamp(name)
    if (camp === null) return false
    setView({ screen: 'dashboard', campId: camp.id }) // jump straight into the new camp
    return true
  }

  // Clear any pending validation error when switching screens, so a rejected
  // create/rename on one screen doesn't linger on the next.
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

  const renderScreen = () => {
    if (openCamp === undefined) {
      return <CampList camps={camps} error={error} onOpen={handleOpen} onCreate={handleCreate} />
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
        summaries={openCampPools}
        error={error}
        onBack={handleBackToList}
        onOpenIncome={() => setView({ screen: 'income', campId: openCamp.id })}
        onRename={renameCamp}
        onDelete={handleDelete}
      />
    )
  }

  return (
    <main className="app">
      <header className="app__header">
        <h1 className="app__title">campfin</h1>
        <p className="app__subtitle">Camp budget tracker</p>
      </header>

      {renderScreen()}
    </main>
  )
}
