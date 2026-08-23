import { useState } from 'react'
import { useFormat, useT } from '../i18n'
import type { CampWindow } from '../lib/camps'
import {
  blankMovementDraft,
  type CustodyFocus,
  type DepositStatus,
  draftFromMovement,
  handoverExcessCents,
  isDepositKind,
  kindsForFocus,
  type MovementDraft,
  movementDraftToInput,
  movementIssues,
  type SaveMovementInput,
} from '../lib/movements'
import { poolColorOf } from '../lib/poolColors'
import type { PoolSummary } from '../lib/pools'
import type { Movement, MovementKind } from '../lib/types'
import './PoolTag.css'
import './ReceiptFilters.css'
import { DateField } from './DateField'
import { RequiredMark } from './RequiredMark'

type Props = {
  campId: string
  /** Which half of the custody money the screen is on — it decides the kinds on offer. */
  focus: CustodyFocus
  /** The row being edited, or null when adding. */
  movement: Movement | null
  /** Deposit pools only — the two deposit kinds are the only ones that name a pool. */
  deposits: PoolSummary[]
  /** Each deposit's custody reading, so a handover can say when it outgrows its pool. */
  statuses: DepositStatus[]
  /** Today, local. Passed in so the form has no clock of its own. */
  todayIso: string
  /** The camp's known span, derived from its per-diem blocks. Highlights those days on the
   *  date picker and asks for confirmation before saving a date outside them. `null` when
   *  the camp has no per-diem income yet, so nothing dates it. */
  campWindow: CampWindow | null
  onSave: (input: SaveMovementInput) => void
  onCancel: () => void
}

/**
 * One movement being typed. Same lock model as the receipt form: one draft, Save commits.
 *
 * The deposit side asks its two questions in the order the answer is decided — which
 * Kaution, then which way it moved — and borrows the receipt form's controls for both: pool
 * chips, then radios like "paid by". Nothing else on the form has more than one answer, so
 * the fee side drops both.
 */
export function MovementForm({
  campId,
  focus,
  movement,
  deposits,
  statuses,
  todayIso,
  campWindow,
  onSave,
  onCancel,
}: Props) {
  const t = useT()
  const format = useFormat()

  // The screen has already narrowed the choice to one half of the custody money; on the
  // fee side that leaves a single kind, so the direction question is dropped rather than
  // shown with one option.
  const kinds = kindsForFocus(focus, deposits.length > 0)
  const firstPoolId = deposits[0]?.pool.id ?? ''

  // The initialiser runs only on the first render — otherwise it would rebuild the draft
  // on every keystroke and throw away what was typed.
  const [draft, setDraft] = useState<MovementDraft>(() =>
    movement === null
      ? blankMovementDraft(todayIso, kinds[0] ?? 'volunteer_in', firstPoolId)
      : draftFromMovement(movement),
  )

  const patch = (fields: Partial<MovementDraft>) => setDraft((d) => ({ ...d, ...fields }))

  // Switching to a deposit kind has to bring a pool with it, or the form would open on an
  // issue the user never caused.
  const handleKind = (kind: MovementKind) =>
    patch({ kind, poolId: isDepositKind(kind) && draft.poolId === '' ? firstPoolId : draft.poolId })

  // Both derived during render, never stored: in state they could drift out of step with
  // the draft they describe.
  const issues = movementIssues(draft)
  // A warning rather than an issue — handing over more than the deposit holds is allowed,
  // and balances as long as all of it comes back.
  const excessCents = handoverExcessCents(draft, statuses, movement)

  // A deposit names a counterparty (a shop, a venue); a participation fee names a person.
  // Same field, different question, so the copy follows the screen's focus rather than
  // sharing one generic label.
  const nameCopy = focus === 'deposits' ? t.movements.deposits : t.movements.fee

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const input = movementDraftToInput(draft, campId, movement)
    // null means invalid; the check narrows the type as a side effect, so validation lives
    // in exactly one place.
    if (input === null) return
    onSave(input)
  }

  return (
    <form className="card card--editing" onSubmit={handleSubmit}>
      {isDepositKind(draft.kind) && (
        <div className="field">
          <span className="field__label">
            {t.movements.poolLabel}
            <RequiredMark />
          </span>
          <div className="filters__chips">
            {deposits.map((summary) => (
              <button
                key={summary.pool.id}
                type="button"
                className={`filters__chip pool-tag--${poolColorOf(summary.pool)}`}
                // A single choice rather than a multi-select filter: picking one deposit
                // switches to it instead of toggling it on top of the one already lit.
                aria-pressed={draft.poolId === summary.pool.id}
                onClick={() => patch({ poolId: summary.pool.id })}
              >
                <span className="pool-tag__dot" aria-hidden="true" />
                {summary.pool.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {kinds.length > 1 && (
        <fieldset className="movement-direction">
          <legend className="field__label">
            {t.movements.directionLabel}
            <RequiredMark />
          </legend>
          {kinds.map((kind) => (
            <label className="field field--check" key={kind}>
              <input
                type="radio"
                name="movement-kind"
                checked={draft.kind === kind}
                onChange={() => handleKind(kind)}
              />
              <span className="field__check-label">{t.movements.kinds[kind]}</span>
            </label>
          ))}
        </fieldset>
      )}

      <div className="field">
        <label className="field__label" htmlFor="movement-date">
          {t.movements.dateLabel}
          <RequiredMark />
        </label>
        <DateField
          id="movement-date"
          mode="single"
          value={draft.date}
          campWindow={campWindow ?? undefined}
          onChange={(date) => patch({ date })}
        />
      </div>

      <label className="field">
        <span className="field__label">
          {nameCopy.nameLabel}
          <RequiredMark />
        </span>
        <input
          className="income-form__input"
          aria-required="true"
          value={draft.name}
          placeholder={nameCopy.namePlaceholder}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            patch({ name: event.target.value })
          }
        />
      </label>

      <label className="field">
        <span className="field__label">
          {t.movements.amountLabel}
          <RequiredMark />
        </span>
        <input
          className="income-form__input income-form__input--amount"
          aria-required="true"
          // inputMode="decimal" so a phone shows a numeric keypad. The value stays a string
          // here; cents happen in `lib/movements.ts`.
          inputMode="decimal"
          value={draft.amount}
          placeholder={t.movements.amountPlaceholder}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            patch({ amount: event.target.value })
          }
        />
        {excessCents > 0 && (
          <span className="field__hint field__hint--warn">
            {t.movements.overDeposit(format.euros(excessCents))}
          </span>
        )}
      </label>

      <label className="field">
        <span className="field__label">{t.movements.noteLabel}</span>
        <input
          className="income-form__input"
          value={draft.note}
          placeholder={t.movements.notePlaceholder}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            patch({ note: event.target.value })
          }
        />
      </label>

      {issues.length > 0 && (
        <ul className="card__issues">
          {issues.map((issue) => (
            <li key={issue}>{t.movements.issues[issue]}</li>
          ))}
        </ul>
      )}

      <div className="card__actions">
        <button className="card__button" type="button" onClick={onCancel}>
          {t.movements.cancel}
        </button>
        <button className="income-form__button" type="submit" disabled={issues.length > 0}>
          {t.movements.save}
        </button>
      </div>
    </form>
  )
}
