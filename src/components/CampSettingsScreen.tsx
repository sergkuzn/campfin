import { useMemo, useState } from 'react'
import './CampSettingsScreen.css'
import { useFormat, useT } from '../i18n'
import { holderChangeImpact, isSamePayer, knownPayers, payerDebts } from '../lib/payers'
import type { PoolSummary } from '../lib/pools'
import type { Camp, Expense } from '../lib/types'
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
  /** This camp's receipts. The holder block reads them for three things: the names to
   *  offer, what is still owed, and how many rows a change of holder would flip. */
  expenses: Expense[]
  onBack: () => void
  onOpenIncome: () => void
  onRename: (name: string) => void
  /** Name the holder, or pass null so nobody holds the money. */
  onChangeHolder: (name: string | null) => void
  onDelete: () => void
}

/**
 * The `<select>` value meaning "I want to type a name that is not on the list". A sentinel
 * rather than the empty string, which already means "nobody holds the money". Prefixed with
 * a control character so no typed name can equal it.
 */
const NEW_HOLDER = '\u0001new-holder'

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
  // Typing a name nobody has used yet. UI mode, not data: "nobody holds it" and "I am about
  // to type someone new" are both an empty picker, and only the user knows which.
  const [addingHolder, setAddingHolder] = useState(false)
  const [newHolder, setNewHolder] = useState('')
  // Held only while the question is on screen. Null is a real answer ("nobody"), so
  // `undefined` is what means "nothing pending".
  const [pendingHolder, setPendingHolder] = useState<string | null | undefined>(undefined)

  const trimmed = name.trim()
  // Derived during render rather than stored: a saved name arrives back as a new `camp`
  // prop, and the button disables itself again without an effect.
  const canSave = trimmed !== '' && trimmed !== camp.name

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSave) return
    onRename(trimmed)
  }

  // Both derived from the receipts, so a name typed on the receipts screen is offered here
  // with no second source of truth to keep in step.
  const payers = useMemo(
    () => knownPayers(expenses, camp.moneyHolder),
    [expenses, camp.moneyHolder],
  )
  const debts = useMemo(() => payerDebts(expenses, camp.moneyHolder), [expenses, camp.moneyHolder])

  // The picker's own value, matched by person rather than by string so a holder stored as
  // "anna" still selects the list's "Anna".
  const holderOption = payers.find((payer) => isSamePayer(payer, camp.moneyHolder)) ?? ''
  const trimmedNewHolder = newHolder.trim()

  // Counted at render time, so the dialog reports the rows as they are now.
  const holderImpact =
    pendingHolder === undefined
      ? null
      : holderChangeImpact(expenses, camp.moneyHolder, pendingHolder)

  const askHolder = (next: string | null) => {
    // Choosing the person who already holds it is not a change, so it asks nothing.
    if (isSamePayer(next ?? '', camp.moneyHolder)) return
    if (camp.moneyHolder === undefined && next !== null) {
      onChangeHolder(next)
      return
    }
    setPendingHolder(next)
  }

  const confirmHolder = () => {
    if (pendingHolder !== undefined) onChangeHolder(pendingHolder)
    setPendingHolder(undefined)
    setAddingHolder(false)
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
        <h3 className="camp-settings__heading">{t.campSettings.holderSection}</h3>
        <p className="camp-settings__hint">{t.campSettings.holderHint}</p>

        <select
          className="camp-settings__input"
          aria-label={t.campSettings.holderLabel}
          value={addingHolder ? NEW_HOLDER : holderOption}
          onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
            const next = event.target.value
            if (next === NEW_HOLDER) {
              setAddingHolder(true)
              return
            }
            setAddingHolder(false)
            // The empty option is "nobody", which is a real answer rather than a blank.
            askHolder(next === '' ? null : next)
          }}
        >
          <option value="">{t.campSettings.holderNone}</option>
          {payers.map((payer) => (
            <option key={payer} value={payer}>
              {payer}
            </option>
          ))}
          <option value={NEW_HOLDER}>{t.campSettings.holderNewOption}</option>
        </select>

        {addingHolder && (
          <form
            className="camp-settings__rename"
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
          </form>
        )}

        {/* Only while something is outstanding — and it is the list you read when settling
            up at the end of camp, so it names the person and the size of the debt. */}
        {debts.length > 0 && (
          <div className="camp-settings__debts">
            <h4 className="camp-settings__subheading">{t.campSettings.holderOwedTitle}</h4>
            <ul className="camp-settings__debt-list">
              {debts.map((debt) => (
                <li className="camp-settings__debt" key={debt.name}>
                  <span>{t.campSettings.holderOwedRow(debt.name, debt.receiptCount)}</span>
                  <strong>{format.euros(debt.owedCents)}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
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

      {/* Changing the holder rewrites no receipt — who owes whom is derived — so the
          question is asked in rows that change rather than in what gets stored. */}
      <ConfirmDialog
        open={pendingHolder !== undefined}
        title={
          pendingHolder === undefined || pendingHolder === null
            ? t.campSettings.holderClearTitle
            : t.campSettings.holderChangeTitle(pendingHolder)
        }
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
