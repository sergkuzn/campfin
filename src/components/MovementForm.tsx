import { useState } from 'react'
import { useT } from '../i18n'
import {
  blankMovementDraft,
  draftFromMovement,
  isDepositKind,
  MOVEMENT_KINDS,
  type MovementDraft,
  movementDraftToInput,
  movementIssues,
  type SaveMovementInput,
} from '../lib/movements'
import type { PoolSummary } from '../lib/pools'
import type { Movement, MovementKind } from '../lib/types'

type Props = {
  campId: string
  /** The row being edited, or null when adding. */
  movement: Movement | null
  /** Deposit pools only — the two deposit kinds are the only ones that name a pool. */
  deposits: PoolSummary[]
  /** Today, local. Passed in so the form has no clock of its own. */
  todayIso: string
  onSave: (input: SaveMovementInput) => void
  onCancel: () => void
}

/** One movement being typed. Same lock model as the receipt form: one draft, Save commits. */
export function MovementForm({ campId, movement, deposits, todayIso, onSave, onCancel }: Props) {
  const t = useT()

  // Without a deposit pool the two deposit kinds have nothing to point at, so the menu
  // offers volunteer money alone rather than a picker with no options.
  const kinds: readonly MovementKind[] = deposits.length === 0 ? ['volunteer_in'] : MOVEMENT_KINDS
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

  // Derived during render, never stored: `issues` in state could drift out of step with
  // the draft it describes.
  const issues = movementIssues(draft)

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
      <label className="field">
        <span className="field__label">{t.movements.kindLabel}</span>
        <select
          className="income-form__input"
          value={draft.kind}
          onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
            handleKind(event.target.value as MovementKind)
          }
        >
          {kinds.map((kind) => (
            <option key={kind} value={kind}>
              {t.movements.kinds[kind]}
            </option>
          ))}
        </select>
      </label>

      {isDepositKind(draft.kind) && (
        <label className="field">
          <span className="field__label">{t.movements.poolLabel}</span>
          <select
            className="income-form__input"
            value={draft.poolId}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
              patch({ poolId: event.target.value })
            }
          >
            {deposits.map((summary) => (
              <option key={summary.pool.id} value={summary.pool.id}>
                {summary.pool.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="field">
        <span className="field__label">{t.movements.dateLabel}</span>
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
        <span className="field__label">{t.movements.nameLabel}</span>
        <input
          className="income-form__input"
          value={draft.name}
          placeholder={t.movements.namePlaceholder}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            patch({ name: event.target.value })
          }
        />
      </label>

      <label className="field">
        <span className="field__label">{t.movements.amountLabel}</span>
        <input
          className="income-form__input income-form__input--amount"
          // inputMode="decimal" so a phone shows a numeric keypad. The value stays a string
          // here; cents happen in `lib/movements.ts`.
          inputMode="decimal"
          value={draft.amount}
          placeholder={t.movements.amountPlaceholder}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            patch({ amount: event.target.value })
          }
        />
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
