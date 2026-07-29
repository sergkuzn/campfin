import { useState } from 'react'
import { formatEuros } from '../lib/budget'
import {
  blockDraftCents,
  draftFromSource,
  draftIssues,
  draftPersonDays,
  draftToInput,
  type SaveSourceInput,
  type SourceDraft,
} from '../lib/drafts'
import type { IncomeKind, IncomeSource, PerDiemBlock, Pool } from '../lib/types'
import { incomeType } from './incomeTypes'
import { PerDiemBlocksEditor } from './PerDiemBlocksEditor'
import { PoolSelect } from './PoolSelect'

type Props = {
  campId: string
  kind: IncomeKind
  /** The row being edited, or null when this is a brand-new card. */
  source: IncomeSource | null
  blocks: PerDiemBlock[] // this source's blocks; [] when new
  pools: Pool[] // this camp's pools, for the selector
  defaultPool: Pool | undefined // pre-selected pool, if any
  onSave: (input: SaveSourceInput) => void
  onCancel: () => void
}

/** An unlocked income card: one editable draft, committed in full by Save. */
export function IncomeSourceForm({
  campId,
  kind,
  source,
  blocks,
  pools,
  defaultPool,
  onSave,
  onCancel,
}: Props) {
  // One state object rather than six useStates: one setter to thread, and `patch`
  // keeps updates immutable. The function form of useState runs the initialiser only
  // on the first render — otherwise draftFromSource would rebuild it on every keystroke.
  const [draft, setDraft] = useState<SourceDraft>(() =>
    draftFromSource(kind, source, blocks, defaultPool),
  )

  const patch = (fields: Partial<SourceDraft>) => setDraft((d) => ({ ...d, ...fields }))

  // Derived during render, not stored: storing `issues` in state would let it drift
  // out of sync with the draft it describes.
  const issues = draftIssues(draft)
  const option = incomeType(kind)

  // What the card is worth as typed. Incomplete rows count as 0 so the number only
  // grows as rows become valid, rather than jumping around.
  const draftTotalCents = draft.blocks.reduce((sum, b) => sum + (blockDraftCents(b) ?? 0), 0)
  const totalPersonDays = draftPersonDays(draft.blocks)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const input = draftToInput(draft, campId, source)
    // null means the draft is invalid; the check narrows the type away as a side effect,
    // so validation lives in exactly one place.
    if (input === null) return
    onSave(input)
  }

  return (
    <form className="card card--editing" onSubmit={handleSubmit}>
      <p className="card__kind">{option.label}</p>

      <label className="field">
        <span className="field__label">Income name</span>
        <input
          className="income-form__input"
          value={draft.name}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            patch({ name: event.target.value })
          }
          placeholder="Name, e.g. Verpflegungspauschale"
        />
      </label>

      {kind === 'per_diem' ? (
        <>
          <PerDiemBlocksEditor blocks={draft.blocks} onChange={(b) => patch({ blocks: b })} />
          <p className="income__total-row">
            <span>Total person-days</span>
            <strong>{totalPersonDays}</strong>
          </p>
          <p className="income__total-row">
            <span>Source total</span>
            <strong>{formatEuros(draftTotalCents)}</strong>
          </p>
        </>
      ) : (
        <label className="field">
          <span className="field__label">Amount</span>
          <input
            className="income-form__input income-form__input--amount"
            // inputMode="decimal" so a phone shows a numeric keypad. The value stays a
            // string here: cents happen in drafts.ts.
            inputMode="decimal"
            value={draft.amount}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              patch({ amount: event.target.value })
            }
            placeholder="€ e.g. 300,00"
          />
        </label>
      )}

      <PoolSelect
        pools={pools}
        value={draft.poolChoice}
        newPoolName={draft.newPoolName}
        sourceName={draft.name}
        // With no pools yet there is nothing to choose between, so the select would be
        // a dropdown with one fake option.
        allowExisting={option.allowExistingPool && pools.length > 0}
        onChange={(value) => patch({ poolChoice: value })}
        onNewPoolNameChange={(name) => patch({ newPoolName: name })}
      />

      {issues.length > 0 && (
        <ul className="card__issues">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}

      <div className="card__actions">
        <button className="card__button" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="income-form__button" type="submit" disabled={issues.length > 0}>
          Save
        </button>
      </div>
    </form>
  )
}
