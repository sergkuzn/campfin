import { useState } from 'react'
import './App.css'
import { CampDashboard } from './components/CampDashboard'
import { CampList } from './components/CampList'
import { useCamps } from './hooks/useCamps'

/**
 * Two screens, no router: the app is a camp list, or one open camp. Which one is
 * *derived* from a single piece of state (the open camp's id) rather than stored
 * twice — "derive, don't duplicate". A real router arrives only if we need URLs.
 */
export default function App() {
  const { camps, error, createCamp, renameCamp, deleteCamp, clearError } = useCamps()
  const [openCampId, setOpenCampId] = useState<string | null>(null)

  // `find` returns `Camp | undefined`; if the open camp was just deleted we fall
  // back to the list automatically, with no effect and no stale state to clean up.
  const openCamp = camps.find((camp) => camp.id === openCampId)

  // createCamp returns null when the name is taken; only navigate on success.
  // Returning the outcome lets the form keep the typed name so it can be corrected.
  const handleCreate = (name: string): boolean => {
    const camp = createCamp(name)
    if (camp === null) return false
    setOpenCampId(camp.id) // jump straight into the camp you just made
    return true
  }

  // Clear any pending validation error when switching screens, so a rejected
  // create/rename on one screen doesn't linger on the next.
  const handleOpen = (campId: string) => {
    clearError()
    setOpenCampId(campId)
  }

  const handleBack = () => {
    clearError()
    setOpenCampId(null)
  }

  const handleDelete = (campId: string) => {
    deleteCamp(campId)
    setOpenCampId(null)
  }

  return (
    <main className="app">
      <header className="app__header">
        <h1 className="app__title">campfin</h1>
        <p className="app__subtitle">Camp budget tracker</p>
      </header>

      {openCamp === undefined ? (
        <CampList camps={camps} error={error} onOpen={handleOpen} onCreate={handleCreate} />
      ) : (
        <CampDashboard
          camp={openCamp}
          error={error}
          onBack={handleBack}
          onRename={renameCamp}
          onDelete={handleDelete}
        />
      )}
    </main>
  )
}
