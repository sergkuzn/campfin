import { useT } from '../i18n'
import { NEW_POOL } from '../lib/drafts'
import type { Pool } from '../lib/types'
import { RequiredMark } from './RequiredMark'

type Props = {
  pools: Pool[] // this camp's pools only
  value: string // an existing pool id, or NEW_POOL
  newPoolName: string
  /** The income's own name, offered as a one-click fill for the new pool's name. */
  sourceName: string
  /** false → no choice offered; this kind always gets a fresh pool. */
  allowExisting: boolean
  onChange: (value: string) => void
  onNewPoolNameChange: (name: string) => void
}

/**
 * Pick an existing pool or name a new one. A controlled component: it holds no state,
 * renders the value it is given and reports changes upward, so the same component works
 * unchanged for a new card and for editing an existing one.
 */
export function PoolSelect({
  pools,
  value,
  newPoolName,
  sourceName,
  allowExisting,
  onChange,
  onNewPoolNameChange,
}: Props) {
  const t = useT()
  const trimmedSourceName = sourceName.trim()
  // Offering the copy only when it would change something keeps the button from
  // looking live while doing nothing.
  const canCopyName = trimmedSourceName !== '' && trimmedSourceName !== newPoolName

  return (
    <div className="pool-select">
      {allowExisting && (
        <label className="pool-select__field field">
          <span className="field__label">{t.poolSelect.label}</span>
          <select
            className="income-form__input"
            value={value}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)}
          >
            {pools.map((pool) => (
              <option key={pool.id} value={pool.id}>
                {pool.name}
              </option>
            ))}
            <option value={NEW_POOL}>{t.poolSelect.newOption}</option>
          </select>
        </label>
      )}

      {value === NEW_POOL && (
        <div className="pool-select__field">
          <label className="field">
            <span className="field__label">
              {t.poolSelect.newNameLabel}
              <RequiredMark />
            </span>
            <input
              className="income-form__input"
              aria-required="true"
              value={newPoolName}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                onNewPoolNameChange(event.target.value)
              }
              placeholder={t.poolSelect.newNamePlaceholder}
            />
          </label>
          <button
            className="pool-select__copy"
            type="button"
            disabled={!canCopyName}
            onClick={() => onNewPoolNameChange(trimmedSourceName)}
          >
            {t.poolSelect.copyName}
          </button>
        </div>
      )}
    </div>
  )
}
