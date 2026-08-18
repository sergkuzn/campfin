import './ReceiptFilters.css'
import './PoolTag.css'
import { useT } from '../i18n'
import type { ExpenseSort } from '../lib/expenses'
import { poolColorOf } from '../lib/poolColors'
import type { Pool } from '../lib/types'

type Props = {
  pools: Pool[]
  sort: ExpenseSort
  onSortChange: (sort: ExpenseSort) => void
  /** The pools being shown. Empty means *all of them* — see `filterExpensesByPools`. */
  selected: ReadonlySet<string>
  onToggle: (poolId: string) => void
  onClear: () => void
}

/** The sort modes in the order the picker offers them: dates first, since that is how the
 *  list has always read, then the two numeric runs. */
const SORTS: readonly ExpenseSort[] = ['date_desc', 'date_asc', 'number_asc', 'number_desc']

/** How the receipt list is ordered and which pools it shows. */
export function ReceiptFilters({ pools, sort, onSortChange, selected, onToggle, onClear }: Props) {
  const t = useT()
  // "Nothing chosen" and "everything chosen" are the same view, so the All chip lights up
  // for both — otherwise switching the last pool off would look like a broken filter.
  const showingAll = selected.size === 0 || selected.size === pools.length

  return (
    <div className="filters">
      <label className="filters__sort">
        <span className="filters__label">{t.receipts.sortLabel}</span>
        <select
          className="income-form__input"
          value={sort}
          // The value of a <select> is always a string, so it is narrowed back to the union
          // here — the one place the cast lives, rather than in every caller.
          onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
            onSortChange(event.target.value as ExpenseSort)
          }
        >
          {SORTS.map((option) => (
            <option key={option} value={option}>
              {t.receipts.sorts[option]}
            </option>
          ))}
        </select>
      </label>

      {pools.length > 1 && (
        <div className="filters__pools">
          <span className="filters__label">{t.receipts.filterLabel}</span>
          <div className="filters__chips">
            <button
              className="filters__chip"
              type="button"
              aria-pressed={showingAll}
              onClick={onClear}
            >
              {t.receipts.filterAll}
            </button>

            {pools.map((pool) => (
              <button
                key={pool.id}
                className={`filters__chip pool-tag--${poolColorOf(pool)}`}
                type="button"
                // A toggle, so its on/off state is announced rather than left to the colour.
                aria-pressed={selected.has(pool.id)}
                onClick={() => onToggle(pool.id)}
              >
                <span className="pool-tag__dot" aria-hidden="true" />
                {pool.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
