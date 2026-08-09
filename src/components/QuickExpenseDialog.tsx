import { useEffect, useId, useRef, useState } from 'react'
import './QuickExpenseDialog.css'
import { useT } from '../i18n'
import {
  blankExpenseDraft,
  type ExpenseDraft,
  expenseDraftToInput,
  expenseIssues,
  type SaveExpenseInput,
} from '../lib/expenses'
import type { Pool } from '../lib/types'

type Props = {
  campId: string
  /** The pool whose ＋ was tapped, or null while the dialog is closed. The parent looks it
   *  up fresh on every render, so a rename mid-sync retitles an open dialog — and a pool
   *  deleted by the other leader closes it rather than leaving a form with no target. */
  pool: Pool | null
  /** Today, local. Passed in so the dialog has no clock of its own. */
  todayIso: string
  onSave: (input: SaveExpenseInput) => void
  /** Fired once the dialog has actually closed, whatever closed it. */
  onClose: () => void
}

/**
 * Add one receipt without leaving the dashboard. The pool is decided by which ＋ was tapped,
 * so the picker — the slowest field on the full form — is gone entirely; what remains is the
 * whole receipt, amount first, with the date already on today. Same fields as the receipts
 * screen minus the one the button answered.
 */
export function QuickExpenseDialog({ campId, pool, todayIso, onSave, onClose }: Props) {
  const t = useT()
  const ref = useRef<HTMLDialogElement>(null)
  // useId gives a value that is stable across renders and unique per component instance —
  // needed here because the title's id is what names the dialog to a screen reader, and a
  // hand-written constant would collide if two dialogs were ever on the page.
  const titleId = useId()

  // A <dialog> keeps open/closed in the DOM, not in React, so the state has to be pushed
  // into it. Both directions matter: the pool can also vanish under an open dialog.
  useEffect(() => {
    const dialog = ref.current
    if (dialog === null) return
    // Guarded both ways — showModal() on an already-open dialog throws.
    if (pool !== null && !dialog.open) dialog.showModal()
    if (pool === null && dialog.open) dialog.close()
  }, [pool])

  return (
    // Every way out — Esc, Cancel, a saved receipt — ends in the native `close` event, so
    // the parent clears its state in exactly one place. close() also hands focus back to
    // the ＋ that opened the dialog, which unmounting the element would not.
    <dialog className="quick" ref={ref} aria-labelledby={titleId} onClose={onClose}>
      {/* Unmounted while closed, so the next ＋ mounts a blank draft with no reset effect. */}
      {pool !== null && (
        <>
          <h3 className="quick__title" id={titleId}>
            {t.receipts.quickTitle(pool.name)}
          </h3>
          <QuickExpenseFields
            campId={campId}
            pool={pool}
            todayIso={todayIso}
            onSave={onSave}
            onDone={() => ref.current?.close()}
          />
        </>
      )}
    </dialog>
  )
}

type FieldsProps = {
  campId: string
  /** Non-null here: the parent only mounts this once a pool is chosen, which is what lets
   *  the draft be seeded straight from `pool.id` instead of guarding a null all the way
   *  down. */
  pool: Pool
  todayIso: string
  onSave: (input: SaveExpenseInput) => void
  /** Close the dialog. Separate from onSave so a save that fails validation cannot close. */
  onDone: () => void
}

function QuickExpenseFields({ campId, pool, todayIso, onSave, onDone }: FieldsProps) {
  const t = useT()

  // The initialiser runs only on the first render — rebuilding the draft on every keystroke
  // would throw away what was typed.
  const [draft, setDraft] = useState<ExpenseDraft>(() => blankExpenseDraft(todayIso, pool.id))

  const patch = (fields: Partial<ExpenseDraft>) => setDraft((d) => ({ ...d, ...fields }))

  // Derived during render, never stored: `issues` in state could drift out of step with the
  // draft it describes.
  const issues = expenseIssues(draft)
  // An untouched draft is not a mistake — without this, two "fill this in" lines would greet
  // every open. They appear once the receipt is half-entered, explaining the grey Save.
  const pristine = draft.name === '' && draft.amount === ''

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    // null for `existing`: quick-add only ever creates. Editing stays on the receipts list,
    // where the row being changed is visible next to the form.
    const input = expenseDraftToInput(draft, campId, null)
    if (input === null) return // invalid; the check also narrows the type
    onSave(input)
    onDone()
  }

  return (
    <form className="quick__form" onSubmit={handleSubmit}>
      {/* Amount first, and first in the DOM: showModal() focuses the dialog's first
          focusable control, so the numeric keypad is up before anything is tapped. */}
      <label className="field">
        <span className="field__label">{t.receipts.amountLabel}</span>
        <input
          className="income-form__input income-form__input--amount"
          // inputMode="decimal" so a phone shows a numeric keypad. The value stays a string
          // here; cents happen in `lib/expenses.ts`.
          inputMode="decimal"
          value={draft.amount}
          placeholder={t.receipts.amountPlaceholder}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            patch({ amount: event.target.value })
          }
        />
      </label>

      <label className="field">
        <span className="field__label">{t.receipts.nameLabel}</span>
        <input
          className="income-form__input"
          value={draft.name}
          placeholder={t.receipts.namePlaceholder}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            patch({ name: event.target.value })
          }
        />
      </label>

      {/* Date and note are on screen rather than behind a disclosure: they are pre-filled
          and optional, so showing them costs a glance, while hiding them costs a tap and
          leaves a leader unsure whether a backdated receipt is even possible here. */}
      <label className="field">
        <span className="field__label">{t.receipts.dateLabel}</span>
        <input
          className="income-form__input"
          type="date"
          value={draft.date}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            patch({ date: event.target.value })
          }
        />
      </label>

      <label className="field">
        <span className="field__label">{t.receipts.noteLabel}</span>
        <input
          className="income-form__input"
          value={draft.note}
          placeholder={t.receipts.notePlaceholder}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            patch({ note: event.target.value })
          }
        />
      </label>

      {!pristine && issues.length > 0 && (
        <ul className="card__issues">
          {issues.map((issue) => (
            <li key={issue}>{t.receipts.issues[issue]}</li>
          ))}
        </ul>
      )}

      <div className="card__actions">
        <button className="card__button" type="button" onClick={onDone}>
          {t.receipts.cancel}
        </button>
        <button className="income-form__button" type="submit" disabled={issues.length > 0}>
          {t.receipts.save}
        </button>
      </div>
    </form>
  )
}
