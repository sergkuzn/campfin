import { useState } from 'react'
import { useT } from '../i18n'
import type { CampWindow } from '../lib/camps'
import {
  blankExpenseDraft,
  draftFromExpense,
  type ExpenseDraft,
  expenseDraftToInput,
  expenseIssues,
  type SaveExpenseInput,
} from '../lib/expenses'
import { poolColorOf } from '../lib/poolColors'
import type { PoolSummary } from '../lib/pools'
import type { Expense } from '../lib/types'
import './IncomeSetup.css'
import './PoolTag.css'
import './ReceiptFilters.css'
import { DateField } from './DateField'
import { PayerSelect } from './PayerSelect'
import { ReceiptNumberField } from './ReceiptNumberField'
import { RequiredMark } from './RequiredMark'

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
  /** The number a new receipt starts on: one past the highest in the camp. */
  suggestedNumber: number
  /** Who holds the camp cash, so "paid out of the camp cash" can name them. Set in camp
   *  settings — this form only reads it. */
  moneyHolder: string | undefined
  /** The camp's known span, derived from its per-diem blocks. Highlights those days on the
   *  date picker and asks for confirmation before saving a date outside them. `null` when
   *  the camp has no per-diem income yet, so nothing dates it. */
  campWindow: CampWindow | null
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
  moneyHolder,
  campWindow,
  onSave,
  onCancel,
}: Props) {
  const t = useT()

  // The initialiser runs only on the first render — otherwise it would rebuild the draft
  // on every keystroke and throw away what was typed.
  const [draft, setDraft] = useState<ExpenseDraft>(() =>
    expense === null
      ? blankExpenseDraft(todayIso, pools[0]?.pool.id ?? '', suggestedNumber)
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
      <div className="field">
        <span className="field__label">
          {t.receipts.poolLabel}
          <RequiredMark />
        </span>
        <div className="filters__chips">
          {pools.map((summary) => (
            <button
              key={summary.pool.id}
              type="button"
              className={`filters__chip pool-tag--${poolColorOf(summary.pool)}`}
              // A single choice rather than a multi-select filter, so picking one pool
              // switches to it instead of toggling it on top of whatever was already lit.
              aria-pressed={draft.poolId === summary.pool.id}
              onClick={() => patch({ poolId: summary.pool.id })}
            >
              <span className="pool-tag__dot" aria-hidden="true" />
              {summary.pool.name}
            </button>
          ))}
        </div>
      </div>

      <div className="block__row">
        <div className="field">
          <label className="field__label" htmlFor="expense-date">
            {t.receipts.dateLabel}
            <RequiredMark />
          </label>
          <DateField
            id="expense-date"
            mode="single"
            value={draft.date}
            campWindow={campWindow ?? undefined}
            onChange={(date) => patch({ date })}
          />
        </div>

        <ReceiptNumberField value={draft.number} onChange={(number) => patch({ number })} />
      </div>

      <label className="field">
        <span className="field__label">
          {t.receipts.nameLabel}
          <RequiredMark />
        </span>
        <input
          className="income-form__input"
          aria-required="true"
          value={draft.name}
          placeholder={t.receipts.namePlaceholder}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            patch({ name: event.target.value })
          }
        />
      </label>

      <label className="field">
        <span className="field__label">
          {t.receipts.amountLabel}
          <RequiredMark />
        </span>
        <input
          className="income-form__input income-form__input--amount"
          aria-required="true"
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

      <PayerSelect
        value={draft.paidBy}
        moneyHolder={moneyHolder}
        reimbursed={draft.reimbursed}
        onChange={(paidBy) => patch({ paidBy })}
        onReimbursedChange={(reimbursed) => patch({ reimbursed })}
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
