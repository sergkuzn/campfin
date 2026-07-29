import './CampDashboard.css'
import { useT } from '../i18n'
import { campStatus } from '../lib/camps'
import { todayIso } from '../lib/dates'
import type { PoolSummary } from '../lib/pools'
import type { Camp } from '../lib/types'
import { ReceivedTotals } from './ReceivedTotals'
import { StatusPill } from './StatusPill'

type Props = {
  camp: Camp
  /** This camp's pools only — the parent has already filtered by campId. */
  summaries: PoolSummary[]
  error: string | null
  onBack: () => void
  onOpenIncome: () => void
  onRename: (campId: string, name: string) => void
  onDelete: (campId: string) => void
}

/**
 * The camp hub.
 */
export function CampDashboard({
  camp,
  summaries,
  error,
  onBack,
  onOpenIncome,
  onRename,
  onDelete,
}: Props) {
  const t = useT()

  const handleRename = () => {
    const next = window.prompt(t.dashboard.renamePrompt, camp.name)
    // `prompt` returns null on cancel — an empty string means "cleared it", also a no-op.
    if (next !== null && next.trim() !== '') onRename(camp.id, next)
  }

  const handleDelete = () => {
    if (window.confirm(t.dashboard.deleteConfirm(camp.name))) onDelete(camp.id)
  }

  const funded = summaries.some((summary) => summary.sources.length > 0)

  return (
    <div className="dashboard">
      <button className="dashboard__back" type="button" onClick={onBack}>
        {t.dashboard.back}
      </button>

      <header className="dashboard__header">
        <h2 className="dashboard__name">{camp.name}</h2>
        <StatusPill status={campStatus(camp, todayIso())} />
      </header>

      <p className="dashboard__code">
        {t.dashboard.joinCode} <code>{camp.id}</code>
      </p>

      <section
        className={
          // Every camp has an everyday pool, so "nothing here yet" means no *income*,
          // not no pools.
          funded ? 'dashboard__slot dashboard__slot--filled' : 'dashboard__slot'
        }
      >
        <p className="dashboard__slot-title">{t.dashboard.receivedTotal}</p>
        <ReceivedTotals summaries={summaries} />
        <button className="dashboard__slot-link" type="button" onClick={onOpenIncome}>
          {t.dashboard.setUpIncome}
        </button>
      </section>

      <section className="dashboard__slot">
        <p className="dashboard__slot-title">{t.dashboard.spending}</p>
        <p className="dashboard__slot-hint">{t.dashboard.noQuittungs}</p>
      </section>

      {error !== null && (
        <p className="dashboard__error" role="alert">
          {error}
        </p>
      )}

      <div className="dashboard__actions">
        <button className="dashboard__action" type="button" onClick={handleRename}>
          {t.dashboard.rename}
        </button>
        <button
          className="dashboard__action dashboard__action--danger"
          type="button"
          onClick={handleDelete}
        >
          {t.dashboard.delete}
        </button>
      </div>
    </div>
  )
}
