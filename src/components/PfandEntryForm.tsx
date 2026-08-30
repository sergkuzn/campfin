import { useState } from 'react'
import { useT } from '../i18n'
import type { CampWindow } from '../lib/camps'
import {
  blankPfandDraft,
  draftFromPfandEntry,
  type PfandDraft,
  pfandDraftToInput,
  pfandIssues,
  type SavePfandInput,
} from '../lib/pfand'
import type { PfandEntry } from '../lib/types'
import { DateField } from './DateField'
import { FormIssues } from './FormIssues'
import { RequiredMark } from './RequiredMark'

type Props = {
  campId: string
  /** The row being edited, or null when adding. */
  entry: PfandEntry | null
  /** What a fresh draft starts on — whose pocket the row is about and the balance to
   *  prefill. Both come from the balance row whose *Refund* was tapped, which is the only
   *  way to open this form: refunding somebody's whole deposit is one tap and then Save. */
  seed: { payer: string; amountCents: number }
  /** Today, local. Passed in so the form has no clock of its own. */
  todayIso: string
  /** The camp's known span, for the date picker. `null` until per-diem income dates it. */
  campWindow: CampWindow | null
  onSave: (input: SavePfandInput) => void
  onCancel: () => void
}

/**
 * One refund being typed: deposit money coming back at a shop, with nothing bought.
 *
 * The only pfand row anybody writes by hand, and the only one whose subject is settled
 * before it opens — it is reached from a person's balance, so it asks neither "what
 * happened?" nor "to whom?" and shows the name as a heading instead. A deposit *charged*
 * arrives on the receipt that charged it, and a deposit changing owner is read off the
 * receipt that was paid back.
 */
export function PfandEntryForm({
  campId,
  entry,
  seed,
  todayIso,
  campWindow,
  onSave,
  onCancel,
}: Props) {
  const t = useT()

  // The initialiser runs only on the first render — otherwise it would rebuild the draft on
  // every keystroke and throw away what was typed.
  const [draft, setDraft] = useState<PfandDraft>(() =>
    entry === null
      ? blankPfandDraft(todayIso, seed.payer, seed.amountCents)
      : draftFromPfandEntry(entry),
  )

  const patch = (fields: Partial<PfandDraft>) => setDraft((d) => ({ ...d, ...fields }))

  // Derived during render, never stored: in state it could drift out of step with the draft
  // it describes.
  const issues = pfandIssues(draft)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const input = pfandDraftToInput(draft, campId, entry)
    // null means invalid; the check narrows the type as a side effect, so validation lives
    // in exactly one place.
    if (input === null) return
    onSave(input)
  }

  return (
    <form className="card card--editing" onSubmit={handleSubmit}>
      {/* The name is the one thing on this card that cannot be changed here, so it is a
          heading rather than a field: it came from the row that was tapped. */}
      <p className="pfand-form__title">{t.pfand.formTitle(draft.payer)}</p>

      <div className="field">
        <label className="field__label" htmlFor="pfand-date">
          {t.pfand.dateLabel}
          <RequiredMark />
        </label>
        <DateField
          id="pfand-date"
          mode="single"
          value={draft.date}
          campWindow={campWindow ?? undefined}
          onChange={(date) => patch({ date })}
        />
      </div>

      <label className="field">
        <span className="field__label">
          {t.pfand.amountLabel}
          <RequiredMark />
        </span>
        <input
          className="input input--amount"
          aria-required="true"
          // inputMode="decimal" so a phone shows a numeric keypad. The value stays a string
          // here; cents happen in `lib/pfand.ts`.
          inputMode="decimal"
          value={draft.amount}
          placeholder={t.pfand.amountPlaceholder}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            patch({ amount: event.target.value })
          }
        />
      </label>

      <label className="field">
        <span className="field__label">{t.pfand.noteLabel}</span>
        <input
          className="input"
          value={draft.note}
          placeholder={t.pfand.notePlaceholder}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            patch({ note: event.target.value })
          }
        />
      </label>

      <FormIssues issues={issues} labels={t.pfand.issues} />

      <div className="card__actions">
        <button className="btn btn--ghost" type="button" onClick={onCancel}>
          {t.pfand.cancel}
        </button>
        <button className="btn btn--primary" type="submit" disabled={issues.length > 0}>
          {t.pfand.save}
        </button>
      </div>
    </form>
  )
}
