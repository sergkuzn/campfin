import { useState } from 'react'
import { useFormat, useT } from '../i18n'
import {
  blockDraftCents,
  draftFromSource,
  draftIssues,
  draftPersonDays,
  draftToInput,
  kindNeedsName,
  type SaveSourceInput,
  type SourceDraft,
} from '../lib/drafts'
import type { IncomeKind, IncomeSource, PerDiemBlock, Pool } from '../lib/types'
import { PerDiemBlocksEditor } from './PerDiemBlocksEditor'
import { RequiredMark } from './RequiredMark'

type Props = {
  campId: string
  /** Decided by the pool this form was opened inside — never asked for. */
  kind: IncomeKind
  /** The pool the income belongs to. Income is always added from within a pool, so there
   *  is no pool question left on this form; the pool also names an income that isn't
   *  named itself. */
  pool: Pool
  /** The row being edited, or null when this is a brand-new card. */
  source: IncomeSource | null
  blocks: PerDiemBlock[] // this source's blocks; [] when new
  onSave: (input: SaveSourceInput) => void
  onCancel: () => void
}

/** An unlocked income card: one editable draft, committed in full by Save. */
export function IncomeSourceForm({ campId, kind, pool, source, blocks, onSave, onCancel }: Props) {
  const t = useT()
  const format = useFormat()

  // One state object rather than six useStates: one setter to thread, and `patch`
  // keeps updates immutable. The function form of useState runs the initialiser only
  // on the first render — otherwise draftFromSource would rebuild it on every keystroke.
  const [draft, setDraft] = useState<SourceDraft>(() => draftFromSource(kind, source, blocks))

  // The "leave it blank" hint costs a line only when asked for, by whoever taps the ⓘ —
  // the same on-demand pattern as the "paid back" explanation on a receipt.
  const [showNameHint, setShowNameHint] = useState(false)

  const patch = (fields: Partial<SourceDraft>) => setDraft((d) => ({ ...d, ...fields }))

  // Derived during render, not stored: storing `issues` in state would let it drift
  // out of sync with the draft it describes.
  const issues = draftIssues(draft)

  // What the card is worth as typed. Incomplete rows count as 0 so the number only
  // grows as rows become valid, rather than jumping around.
  const draftTotalCents = draft.blocks.reduce((sum, b) => sum + (blockDraftCents(b) ?? 0), 0)
  const totalPersonDays = draftPersonDays(draft.blocks)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const input = draftToInput(draft, campId, pool.id, source)
    // null means the draft is invalid; the check narrows the type away as a side effect,
    // so validation lives in exactly one place.
    if (input === null) return
    onSave(input)
  }

  return (
    <form className="card card--editing" onSubmit={handleSubmit}>
      {/* The kind is a statement, not a question: the pool decided it. The pool it lands
          in is already on screen, so naming it again here would only repeat the obvious. */}
      <p className="card__kind">{t.income.kinds[kind].label}</p>

      {/* Only a fixed grant can end up beside a sibling it has to be told apart from, and
          even then the name is optional — left blank, the income answers to its pool's
          name, which then stays right when the pool is renamed. */}
      {kindNeedsName(kind) && (
        <label className="field">
          <span className="field__label">
            {t.income.nameLabel}
            <button
              type="button"
              className="info-button"
              aria-expanded={showNameHint}
              aria-label={t.income.nameHintLabel}
              onClick={() => setShowNameHint((shown) => !shown)}
            >
              ⓘ
            </button>
          </span>
          <input
            className="input"
            value={draft.name}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              patch({ name: event.target.value })
            }
            placeholder={pool.name}
          />
          {showNameHint && <span className="field__hint">{t.income.nameHint}</span>}
        </label>
      )}

      {kind === 'per_diem' ? (
        <>
          <PerDiemBlocksEditor blocks={draft.blocks} onChange={(b) => patch({ blocks: b })} />
          <footer className="income__totals">
            <p className="income__total-row">
              <span>{t.income.personDaysTotal}</span>
              <strong>{totalPersonDays}</strong>
            </p>
            <p className="income__total-row">
              <span>{t.income.sourceTotal}</span>
              <strong>{format.euros(draftTotalCents)}</strong>
            </p>
          </footer>
        </>
      ) : (
        <label className="field">
          <span className="field__label">
            {t.income.amountLabel}
            <RequiredMark />
          </span>
          <input
            className="input input--amount"
            aria-required="true"
            // inputMode="decimal" so a phone shows a numeric keypad. The value stays a
            // string here: cents happen in drafts.ts.
            inputMode="decimal"
            value={draft.amount}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              patch({ amount: event.target.value })
            }
            placeholder={t.income.amountPlaceholder}
          />
        </label>
      )}

      {issues.length > 0 && (
        <ul className="card__issues">
          {issues.map((issue) => (
            <li key={issue}>{t.income.issues[issue]}</li>
          ))}
        </ul>
      )}

      <div className="card__actions">
        <button className="card__button" type="button" onClick={onCancel}>
          {t.income.cancel}
        </button>
        <button className="btn" type="submit" disabled={issues.length > 0}>
          {t.income.save}
        </button>
      </div>
    </form>
  )
}
