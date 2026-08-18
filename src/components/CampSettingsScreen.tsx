import { useState } from 'react'
import './CampSettingsScreen.css'
import { useT } from '../i18n'
import type { PoolSummary } from '../lib/pools'
import type { Camp } from '../lib/types'
import { ConfirmDialog } from './ConfirmDialog'
import { JoinCodeCard } from './JoinCodeCard'
import { ReceivedTotals } from './ReceivedTotals'

type Props = {
  camp: Camp
  /** This camp's pools only — the parent has already filtered by campId. */
  summaries: PoolSummary[]
  /** How many leaders share this camp. A count, never names. */
  memberCount: number
  /** Only the camp's admin may delete it; everyone else sees no danger zone at all. */
  isAdmin: boolean
  isLoading: boolean
  error: string | null
  onBack: () => void
  onOpenIncome: () => void
  onRename: (name: string) => void
  onDelete: () => void
}

/**
 * Everything about the camp itself rather than today's money: its name, its join code,
 * what it was granted, and deleting it.
 *
 * It is a screen and not a dropdown because these are the things you do once, at the
 * start or the end — keeping them off the dashboard means a destructive button is never
 * one mis-tap away during the two weeks the app is actually used.
 */
export function CampSettingsScreen({
  camp,
  summaries,
  memberCount,
  isAdmin,
  isLoading,
  error,
  onBack,
  onOpenIncome,
  onRename,
  onDelete,
}: Props) {
  const t = useT()
  const [name, setName] = useState(camp.name)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const trimmed = name.trim()
  // Derived during render rather than stored: a saved name arrives back as a new `camp`
  // prop, and the button disables itself again without an effect.
  const canSave = trimmed !== '' && trimmed !== camp.name

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSave) return
    onRename(trimmed)
  }

  return (
    <div className="camp-settings">
      <button className="screen-back" type="button" onClick={onBack}>
        {t.campSettings.back}
      </button>

      <h2 className="camp-settings__title">{t.campSettings.title}</h2>

      {error !== null && (
        <p className="dashboard__error" role="alert">
          {error}
        </p>
      )}

      <section className="camp-settings__section">
        <h3 className="camp-settings__heading">{t.campSettings.nameSection}</h3>
        <form className="camp-settings__rename" onSubmit={handleSubmit}>
          {/* The section heading above already names the field, so a visible label would
              say it twice; the accessible name still has to be spelled out. */}
          <input
            className="camp-settings__input"
            aria-label={t.campSettings.nameLabel}
            type="text"
            value={name}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
          />
          <button className="camp-settings__save" type="submit" disabled={!canSave}>
            {t.campSettings.save}
          </button>
        </form>
      </section>

      <section className="camp-settings__section">
        <h3 className="camp-settings__heading">{t.campSettings.shareSection}</h3>
        <JoinCodeCard joinCode={camp.joinCode} memberCount={memberCount} />
      </section>

      <section className="camp-settings__section">
        <h3 className="camp-settings__heading">{t.campSettings.incomeSection}</h3>
        {isLoading ? (
          <p className="dashboard__slot-hint">{t.app.loading}</p>
        ) : (
          <ReceivedTotals summaries={summaries} />
        )}
        <button className="dashboard__slot-link" type="button" onClick={onOpenIncome}>
          {t.dashboard.setUpIncome}
        </button>
      </section>

      {isAdmin && (
        <section className="camp-settings__section camp-settings__section--danger">
          <h3 className="camp-settings__heading">{t.campSettings.dangerSection}</h3>
          <button
            className="camp-settings__delete"
            type="button"
            onClick={() => setConfirmingDelete(true)}
          >
            {t.campSettings.delete}
          </button>
        </section>
      )}

      <ConfirmDialog
        open={confirmingDelete}
        title={t.campSettings.deleteTitle}
        lines={[t.campSettings.deleteConfirm(camp.name), t.campSettings.deleteLine]}
        confirmLabel={t.campSettings.deleteConfirmLabel}
        onConfirm={() => {
          setConfirmingDelete(false)
          onDelete()
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  )
}
