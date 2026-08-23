import { useState } from 'react'
import './CampSettingsScreen.css'
import { useFormat, useT } from '../i18n'
import { type CampWindow, windowLabel } from '../lib/camps'
import { dayCount } from '../lib/dates'
import { holderChangeImpact, isSamePayer } from '../lib/payers'
import type { PoolSummary } from '../lib/pools'
import type { Camp, Expense } from '../lib/types'
import { ConfirmDialog } from './ConfirmDialog'
import { JoinCodeCard } from './JoinCodeCard'
import { ReceivedTotals } from './ReceivedTotals'
import { SlotCard, SlotPanel } from './SlotCard'

type Props = {
  camp: Camp
  /** This camp's pools only — the parent has already filtered by campId. */
  summaries: PoolSummary[]
  /** How many leaders share this camp. A count, never names. */
  memberCount: number
  /** The camp's span, derived from its per-diem blocks — shown here, never edited here.
   *  `null` when no per-diem income dates the camp yet. */
  campWindow: CampWindow | null
  /** Only the camp's admin may delete it; everyone else sees no danger zone at all. */
  isAdmin: boolean
  isLoading: boolean
  error: string | null
  /** This camp's receipts. The holder block reads them only to count how many rows a
   *  change of holder would flip. */
  expenses: Expense[]
  onBack: () => void
  onOpenIncome: () => void
  onRename: (name: string) => void
  /** Hand the money to this person. There is no way to hand it to nobody: every "owed"
   *  marker and the settlement sheet are measured against the holder. */
  onChangeHolder: (name: string) => void
  onDelete: () => void
}

/**
 * Everything about the camp itself rather than today's money: its name, its join code,
 * who carries the cash, what it was granted, and deleting it.
 *
 * It is a screen and not a dropdown because these are the things you do once, at the
 * start or the end — keeping them off the dashboard means a destructive button is never
 * one mis-tap away during the two weeks the app is actually used.
 */
export function CampSettingsScreen({
  camp,
  summaries,
  memberCount,
  campWindow,
  isAdmin,
  isLoading,
  error,
  expenses,
  onBack,
  onOpenIncome,
  onRename,
  onChangeHolder,
  onDelete,
}: Props) {
  const t = useT()
  const format = useFormat()
  const [name, setName] = useState(camp.name)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  // Whether the name field is on screen. UI mode, not data: the stored holder says who it
  // is, never whether you are in the middle of typing a replacement.
  const [changingHolder, setChangingHolder] = useState(false)
  const [newHolder, setNewHolder] = useState('')
  // Held only while the confirm question is on screen; `undefined` means nothing pending.
  const [pendingHolder, setPendingHolder] = useState<string | undefined>(undefined)

  const trimmed = name.trim()
  // Derived during render rather than stored: a saved name arrives back as a new `camp`
  // prop, and the button disables itself again without an effect.
  const canSave = trimmed !== '' && trimmed !== camp.name

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSave) return
    onRename(trimmed)
  }

  const trimmedNewHolder = newHolder.trim()

  // A card with no income yet keeps the dashed placeholder border, same as on the hub.
  const funded = summaries.some((summary) => summary.sources.length > 0)

  // Counted at render time, so the dialog reports the rows as they are now.
  const holderImpact =
    pendingHolder === undefined
      ? null
      : holderChangeImpact(expenses, camp.moneyHolder, pendingHolder)

  const askHolder = (next: string) => {
    // Naming the person who already holds it is not a change, so it asks nothing.
    if (isSamePayer(next, camp.moneyHolder)) {
      setChangingHolder(false)
      setNewHolder('')
      return
    }
    setPendingHolder(next)
  }

  const confirmHolder = () => {
    if (pendingHolder !== undefined) onChangeHolder(pendingHolder)
    setPendingHolder(undefined)
    setChangingHolder(false)
    setNewHolder('')
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

      <SlotPanel title={t.campSettings.nameSection}>
        <form className="camp-settings__row" onSubmit={handleSubmit}>
          {/* The panel title above already names the field, so a visible label would say
              it twice; the accessible name still has to be spelled out. */}
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
      </SlotPanel>

      {/* Stated, not edited: the camp's days are the span of its per-diem blocks, so the
          only way to change them is to change those blocks on the income screen. */}
      <SlotPanel title={t.campSettings.datesSection}>
        {campWindow === null ? (
          <p className="camp-settings__hint">{t.campSettings.datesNone}</p>
        ) : (
          <>
            <p className="camp-settings__dates">
              <strong>{windowLabel(campWindow, format.day)}</strong>{' '}
              <span className="camp-settings__dates-days">
                ({t.campSettings.datesDays(dayCount(campWindow.startIso, campWindow.endIso))})
              </span>
            </p>
            <p className="camp-settings__hint">{t.campSettings.datesFrom}</p>
          </>
        )}
      </SlotPanel>

      <SlotPanel title={t.campSettings.shareSection}>
        <JoinCodeCard joinCode={camp.joinCode} memberCount={memberCount} />
      </SlotPanel>

      {/* No list of everyone the receipts name: the wallet changes hands once a camp at
          most, so the screen states who has it and offers the one thing you might do. */}
      <SlotPanel title={t.campSettings.holderSection}>
        <p className="camp-settings__hint">{t.campSettings.holderHint}</p>

        <p className="camp-settings__holder">
          {camp.moneyHolder === undefined ? (
            t.campSettings.holderNone
          ) : (
            <>
              {/* The name stands out from the sentence around it — it is the one word on
                  this card that differs from camp to camp. */}
              <strong className="camp-settings__holder-name">{camp.moneyHolder}</strong>{' '}
              {t.campSettings.holderHolds}
            </>
          )}
        </p>

        {changingHolder ? (
          <form
            className="camp-settings__row"
            onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              if (trimmedNewHolder !== '') askHolder(trimmedNewHolder)
            }}
          >
            <input
              className="camp-settings__input"
              aria-label={t.campSettings.holderNewNameLabel}
              type="text"
              value={newHolder}
              placeholder={t.campSettings.holderNewNamePlaceholder}
              // biome-ignore lint/a11y/noAutofocus: the tap revealed this one field, so focusing it saves a second tap
              autoFocus
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setNewHolder(event.target.value)
              }
            />
            <button
              className="camp-settings__save"
              type="submit"
              disabled={trimmedNewHolder === ''}
            >
              {t.campSettings.holderSave}
            </button>
            <button
              className="camp-settings__ghost"
              type="button"
              onClick={() => {
                setChangingHolder(false)
                setNewHolder('')
              }}
            >
              {t.campSettings.holderCancel}
            </button>
          </form>
        ) : (
          <div className="camp-settings__holder-actions">
            {/* Only ever a hand-over: the wallet cannot be put down, so there is no
                counterpart to this button. */}
            <button
              className="camp-settings__ghost"
              type="button"
              onClick={() => setChangingHolder(true)}
            >
              {camp.moneyHolder === undefined
                ? t.campSettings.holderSet
                : t.campSettings.holderChange}
            </button>
          </div>
        )}
      </SlotPanel>

      <SlotCard
        title={t.campSettings.incomeSection}
        action={t.dashboard.setUpIncome}
        onOpen={onOpenIncome}
        filled={funded}
      >
        {isLoading ? (
          <p className="slot-card__hint">{t.app.loading}</p>
        ) : (
          <ReceivedTotals summaries={summaries} />
        )}
      </SlotCard>

      {isAdmin && (
        <SlotPanel title={t.campSettings.dangerSection} className="camp-settings__danger">
          <button
            className="camp-settings__delete"
            type="button"
            onClick={() => setConfirmingDelete(true)}
          >
            {t.campSettings.delete}
          </button>
        </SlotPanel>
      )}

      {/* Changing the holder rewrites no receipt — who owes whom is derived — so the
          question is asked in rows that change rather than in what gets stored. */}
      <ConfirmDialog
        open={pendingHolder !== undefined}
        title={pendingHolder === undefined ? '' : t.campSettings.holderChangeTitle(pendingHolder)}
        lines={
          holderImpact === null
            ? []
            : [
                ...(camp.moneyHolder === undefined
                  ? []
                  : [t.campSettings.holderReplaces(camp.moneyHolder)]),
                ...(holderImpact.stopOwing === 0 && holderImpact.startOwing === 0
                  ? [t.campSettings.holderNoChange]
                  : [
                      ...(holderImpact.stopOwing > 0
                        ? [t.campSettings.holderStopOwing(holderImpact.stopOwing)]
                        : []),
                      ...(holderImpact.startOwing > 0
                        ? [t.campSettings.holderStartOwing(holderImpact.startOwing)]
                        : []),
                    ]),
              ]
        }
        confirmLabel={t.campSettings.holderConfirm}
        onConfirm={confirmHolder}
        onCancel={() => setPendingHolder(undefined)}
      />

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
