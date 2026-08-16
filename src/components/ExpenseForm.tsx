import { useState } from 'react'
import { useT } from '../i18n'
import {
  blankExpenseDraft,
  draftFromExpense,
  type ExpenseDraft,
  expenseDraftToInput,
  expenseIssues,
  type SaveExpenseInput,
} from '../lib/expenses'
import type { PoolSummary } from '../lib/pools'
import type { Expense } from '../lib/types'
import { ReceiptNumberField } from './ReceiptNumberField'

type Props = {
  campId: string
  /** The row being edited, or null when adding a new receipt. */
  expense: Expense | null
  /** Pools a receipt can be tagged to: the spendable ones. Deposit money is held, not
   *  spent, and is settled on the deposits screen instead. */
  pools: PoolSummary[]
  /** Today, local. Passed in so the form has no clock of its own. */
  todayIso: string
  /** Receipt numbers other rows already carry — a duplicate blocks the save. */
  takenNumbers: ReadonlySet<number>
  /** What the "next number" button fills in: one past the highest in the camp. */
  suggestedNumber: number
  onSave: (input: SaveExpenseInput) => void
  onCancel: () => void
}

/** One receipt being typed. Same shape as the income card: one draft, Save commits it. */
export function ExpenseForm({
  campId,
  expense,
  pools,
  todayIso,
  takenNumbers,
  suggestedNumber,
  onSave,
  onCancel,
}: Props) {
  const t = useT()

  // The initialiser runs only on the first render — otherwise it would rebuild the draft
  // on every keystroke and throw away what was typed.
  const [draft, setDraft] = useState<ExpenseDraft>(() =>
    expense === null
      ? blankExpenseDraft(todayIso, pools[0]?.pool.id ?? '')
      : draftFromExpense(expense),
  )

  const patch = (fields: Partial<ExpenseDraft>) => setDraft((d) => ({ ...d, ...fields }))

  // Derived during render, never stored: `issues` in state could drift out of step with
  // the draft it describes.
  const issues = expenseIssues(draft, takenNumbers)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const input = expenseDraftToInput(draft, campId, expense, takenNumbers)
    // null means invalid; the check narrows the type as a side effect, so validation
    // lives in exactly one place.
    if (input === null) return
    onSave(input)
  }

  return (
    <form className="card card--editing" onSubmit={handleSubmit}>
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

      <label className="field">
        <span className="field__label">{t.receipts.amountLabel}</span>
        <input
          className="income-form__input income-form__input--amount"
          // inputMode="decimal" so a phone shows a numeric keypad. The value stays a
          // string here; cents happen in `lib/expenses.ts`.
          inputMode="decimal"
          value={draft.amount}
          placeholder={t.receipts.amountPlaceholder}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            patch({ amount: event.target.value })
          }
        />
      </label>

      <label className="field">
        <span className="field__label">{t.receipts.poolLabel}</span>
        <select
          className="income-form__input"
          value={draft.poolId}
          onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
            patch({ poolId: event.target.value })
          }
        >
          {pools.map((summary) => (
            <option key={summary.pool.id} value={summary.pool.id}>
              {summary.pool.name}
            </option>
          ))}
        </select>
      </label>

      <ReceiptNumberField
        value={draft.number}
        suggestion={suggestedNumber}
        onChange={(number) => patch({ number })}
      />

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

      {issues.length > 0 && (
        <ul className="card__issues">
          {issues.map((issue) => (
            <li key={issue}>{t.receipts.issues[issue]}</li>
          ))}
        </ul>
      )}

      <div className="card__actions">
        <button className="card__button" type="button" onClick={onCancel}>
          {t.receipts.cancel}
        </button>
        <button className="income-form__button" type="submit" disabled={issues.length > 0}>
          {t.receipts.save}
        </button>
      </div>
    </form>
  )
}
