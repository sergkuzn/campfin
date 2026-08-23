import { useState } from 'react'
import { useT } from '../i18n'
import {
  type PoolDraft,
  poolDraftIssues,
  poolDraftToInput,
  type SavePoolInput,
} from '../lib/drafts'
import type { CreatablePoolRole } from '../lib/types'
import { RequiredMark } from './RequiredMark'

type Props = {
  campId: string
  onSave: (input: SavePoolInput) => void
  onCancel: () => void
}

/** The two kinds a leader can make. The everyday pool is born with the camp, so it is
 *  not on offer here — `CreatablePoolRole` is what keeps it out at compile time. */
const ROLES: readonly CreatablePoolRole[] = ['earmarked', 'deposit']

/**
 * "＋ Add pool": a name and what the pot is for. No colour question — a new pool takes the
 * first hue none of its siblings is wearing, and the ⋮ menu changes it afterwards.
 */
export function PoolForm({ campId, onSave, onCancel }: Props) {
  const t = useT()
  const [draft, setDraft] = useState<PoolDraft>({ name: '', role: 'earmarked' })

  const issues = poolDraftIssues(draft)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const input = poolDraftToInput(draft, campId)
    // null means the draft is invalid; the check narrows the type away as a side effect,
    // so validation lives in exactly one place.
    if (input === null) return
    onSave(input)
  }

  return (
    <form className="card card--editing" onSubmit={handleSubmit}>
      <p className="card__kind">{t.pools.addTitle}</p>

      <label className="field">
        <span className="field__label">
          {t.pools.nameLabel}
          <RequiredMark />
        </span>
        <input
          className="input"
          aria-required="true"
          value={draft.name}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setDraft((d) => ({ ...d, name: event.target.value }))
          }
          placeholder={t.pools.namePlaceholder}
        />
      </label>

      {/* Radios rather than a <select>: there are two choices, both need a sentence of
          explanation, and a dropdown can show neither until it is opened. */}
      <fieldset className="pool-roles">
        <legend className="field__label">{t.pools.roleLabel}</legend>
        {ROLES.map((role) => (
          <label className="pool-roles__option" key={role}>
            <input
              type="radio"
              name="pool-role"
              value={role}
              checked={draft.role === role}
              onChange={() => setDraft((d) => ({ ...d, role }))}
            />
            <span>
              <span className="field__check-label">{t.pools.roles[role].label}</span>
              <span className="field__hint">{t.pools.roles[role].hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {issues.length > 0 && (
        <ul className="card__issues">
          {issues.map((issue) => (
            <li key={issue}>{t.income.issues[issue]}</li>
          ))}
        </ul>
      )}

      <div className="card__actions">
        <button className="btn btn--ghost" type="button" onClick={onCancel}>
          {t.income.cancel}
        </button>
        <button className="btn btn--primary" type="submit" disabled={issues.length > 0}>
          {t.pools.addSave}
        </button>
      </div>
    </form>
  )
}
