import './ReceiptFilters.css'
import './PoolTag.css'
import { useT } from '../i18n'
import type { ExpenseSort } from '../lib/expenseViews'
import { poolColorOf } from '../lib/poolColors'
import type { Pool } from '../lib/types'

type Props = {
  pools: Pool[]
  sort: ExpenseSort
  onSortChange: (sort: ExpenseSort) => void
  /** The pools being shown. Empty means *all of them* — see `filterExpensesByPools`. */
  selected: ReadonlySet<string>
  onToggle: (poolId: string) => void
  /** False while no money holder is named: with nobody to owe the money, the "not repaid"
   *  toggle could only ever answer with an empty list. */
  canOwe: boolean
  /** True while the list is limited to money the holder still owes. */
  unpaidOnly: boolean
  onUnpaidChange: (unpaidOnly: boolean) => void
}

/** The sort modes in the order the picker offers them: dates first, since that is how the
 *  list has always read, then the two numeric runs. */
const SORTS: readonly ExpenseSort[] = ['date_desc', 'date_asc', 'number_asc', 'number_desc']

/** How the receipt list is ordered and which pools it shows. */
export function ReceiptFilters({
  pools,
  sort,
  onSortChange,
  selected,
  onToggle,
  canOwe,
  unpaidOnly,
  onUnpaidChange,
}: Props) {
  const t = useT()

  return (
    <div className="filters">
      {/* The repayment toggle rides on the sort row rather than taking a line of its own:
          one chip alone on a full-width line reads as a heading for what follows it. It
          sits outside the <label>, so tapping it does not also focus the select. */}
      <div className="filters__row">
        <label className="filters__sort">
          <span className="filters__label">{t.receipts.sortLabel}</span>
          <select
            className="input"
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

        {canOwe && (
          <button
            className="filters__chip filters__chip--owed"
            type="button"
            aria-pressed={unpaidOnly}
            onClick={() => onUnpaidChange(!unpaidOnly)}
          >
            {t.receipts.payer.filterUnpaid}
          </button>
        )}
      </div>

      {pools.length > 1 && (
        <div className="filters__pools">
          <span className="filters__label">{t.receipts.filterLabel}</span>
          <div className="filters__chips">
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
