import { useState } from 'react'
import { useT } from '../i18n'
import type { CampWindow } from '../lib/camps'
import {
  blankOtherExpenseDraft,
  draftFromOtherExpense,
  type OtherExpenseDraft,
  otherExpenseDraftToInput,
  otherExpenseIssues,
  type SaveOtherExpenseInput,
} from '../lib/otherExpenses'
import type { OtherExpense } from '../lib/types'
import { DateField } from './DateField'
import { FormIssues } from './FormIssues'
import { PayerSelect } from './PayerSelect'
import { RequiredMark } from './RequiredMark'

type Props = {
  campId: string
  /** The row being edited, or null when adding a new one. */
  expense: OtherExpense | null
  /** Today, local. Passed in so the form has no clock of its own. */
  todayIso: string
  /** Who holds the camp cash, so "paid it themselves" can name them. */
  moneyHolder: string | undefined
  /** The camp's known span, for the date picker. `null` when no per-diem income dates it. */
  campWindow: CampWindow | null
  onSave: (input: SaveOtherExpenseInput) => void
  onCancel: () => void
}

/**
 * One out-of-pocket expense being typed. The receipt form minus everything that belongs to
 * a pool: no pool chips, no receipt number, no pfand block — this money bought something
 * the camp's income does not pay for, so there is no pot to tag it to.
 */
export function OtherExpenseForm({
  campId,
  expense,
  todayIso,
  moneyHolder,
  campWindow,
  onSave,
  onCancel,
}: Props) {
  const t = useT()

  // The initialiser runs only on the first render — otherwise it would rebuild the draft
  // on every keystroke and throw away what was typed.
  const [draft, setDraft] = useState<OtherExpenseDraft>(() =>
    expense === null ? blankOtherExpenseDraft(todayIso) : draftFromOtherExpense(expense),
  )

  const patch = (fields: Partial<OtherExpenseDraft>) => setDraft((d) => ({ ...d, ...fields }))

  // Derived during render, never stored: `issues` in state could drift out of step with
  // the draft it describes.
  const issues = otherExpenseIssues(draft)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const input = otherExpenseDraftToInput(draft, campId, expense)
    // null means invalid; the check narrows the type as a side effect, so validation lives
    // in exactly one place.
    if (input === null) return
    onSave(input)
  }

  return (
    <form className="card card--editing" onSubmit={handleSubmit}>
      <div className="field">
        <label className="field__label" htmlFor="other-expense-date">
          {t.otherExpenses.dateLabel}
          <RequiredMark />
        </label>
        <DateField
          id="other-expense-date"
          mode="single"
          value={draft.date}
          campWindow={campWindow ?? undefined}
          onChange={(date) => patch({ date })}
        />
      </div>

      <label className="field">
        <span className="field__label">
          {t.otherExpenses.nameLabel}
          <RequiredMark />
        </span>
        <input
          className="input"
          aria-required="true"
          value={draft.name}
          placeholder={t.otherExpenses.namePlaceholder}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            patch({ name: event.target.value })
          }
        />
      </label>

      <label className="field">
        <span className="field__label">
          {t.otherExpenses.amountLabel}
          <RequiredMark />
        </span>
        <input
          className="input input--amount"
          aria-required="true"
          // inputMode="decimal" so a phone shows a numeric keypad. The value stays a string
          // here; cents happen in `lib/otherExpenses.ts`.
          inputMode="decimal"
          value={draft.amount}
          placeholder={t.otherExpenses.amountPlaceholder}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            patch({ amount: event.target.value })
          }
        />
      </label>

      {/* The same picker the receipt form uses: whose money it was is the same question
          here, and answering it two different ways on two screens would be the surprise. */}
      <PayerSelect
        value={draft.paidBy}
        moneyHolder={moneyHolder}
        onChange={(paidBy) => patch({ paidBy })}
      />

      <label className="field">
        <span className="field__label">{t.otherExpenses.noteLabel}</span>
        <input
          className="input"
          value={draft.note}
          placeholder={t.otherExpenses.notePlaceholder}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            patch({ note: event.target.value })
          }
        />
      </label>

      <FormIssues issues={issues} labels={t.otherExpenses.issues} />

      <div className="card__actions">
        <button className="btn btn--ghost btn--back" type="button" onClick={onCancel}>
          {t.otherExpenses.cancel}
        </button>
        <button className="btn btn--primary" type="submit" disabled={issues.length > 0}>
          {t.otherExpenses.save}
        </button>
      </div>
    </form>
  )
}
