import './CampDashboard.css'
import { campStatus } from '../lib/camps'
import { todayIso } from '../lib/dates'
import type { Camp } from '../lib/types'
import { StatusPill } from './StatusPill'

type Props = {
  camp: Camp
  error: string | null
  onBack: () => void
  onRename: (campId: string, name: string) => void
  onDelete: (campId: string) => void
}

/**
 * The camp hub.
 */
export function CampDashboard({ camp, error, onBack, onRename, onDelete }: Props) {
  const handleRename = () => {
    const next = window.prompt('Rename camp', camp.name)
    // `prompt` returns null on cancel — an empty string means "cleared it", also a no-op.
    if (next !== null && next.trim() !== '') onRename(camp.id, next)
  }

  const handleDelete = () => {
    if (window.confirm(`Delete "${camp.name}"? This cannot be undone.`)) onDelete(camp.id)
  }

  return (
    <div className="dashboard">
      <button className="dashboard__back" type="button" onClick={onBack}>
        ← All camps
      </button>

      <header className="dashboard__header">
        <h2 className="dashboard__name">{camp.name}</h2>
        <StatusPill status={campStatus(camp, todayIso())} />
      </header>

      <p className="dashboard__code">
        Join code <code>{camp.id}</code>
      </p>

      <section className="dashboard__slot">
        <p className="dashboard__slot-title">Received total</p>
        <p className="dashboard__slot-hint">No income sources yet.</p>
      </section>

      <section className="dashboard__slot">
        <p className="dashboard__slot-title">Spending</p>
        <p className="dashboard__slot-hint">No quittungs yet.</p>
      </section>

      {error !== null && (
        <p className="dashboard__error" role="alert">
          {error}
        </p>
      )}

      <div className="dashboard__actions">
        <button className="dashboard__action" type="button" onClick={handleRename}>
          Rename
        </button>
        <button
          className="dashboard__action dashboard__action--danger"
          type="button"
          onClick={handleDelete}
        >
          Delete camp
        </button>
      </div>
    </div>
  )
}
