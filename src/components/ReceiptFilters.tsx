import './ReceiptFilters.css'
import './PoolTag.css'
import { useT } from '../i18n'
import type { ExpenseSort } from '../lib/expenses'
import type { PayerFilter } from '../lib/payers'
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
  /** Names in use in this camp, holder first. Empty while nobody has been tracked, and
   *  then neither payer control is worth showing. */
  payers: string[]
  /** Who the list is limited to: everyone, one person, or the receipts with no payer. */
  payerFilter: PayerFilter
  onPayerChange: (filter: PayerFilter) => void
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
  onClear,
  payers,
  payerFilter,
  onPayerChange,
  canOwe,
  unpaidOnly,
  onUnpaidChange,
}: Props) {
  const t = useT()
  // One name is already enough to be worth filtering by: with a money holder named and
  // nobody else yet, "No payer set" is the list of receipts still to be filled in.
  const showPayers = payers.length > 0
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

      {showPayers && (
        <label className="filters__sort">
          <span className="filters__label">{t.receipts.payer.filterPayerLabel}</span>
          <select
            className="income-form__input"
            // A <select> speaks only strings, so the three filter states are mapped to
            // option values here and back to the union on the way out — the one place the
            // conversion lives.
            value={payerFilter.kind === 'person' ? payerFilter.name : payerFilter.kind}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
              const next = event.target.value
              if (next === 'all' || next === 'untracked') {
                onPayerChange({ kind: next })
                return
              }
              onPayerChange({ kind: 'person', name: next })
            }}
          >
            <option value="all">{t.receipts.payer.filterPayerAll}</option>
            {payers.map((payer) => (
              <option key={payer} value={payer}>
                {payer}
              </option>
            ))}
            <option value="untracked">{t.receipts.payer.filterPayerUntracked}</option>
          </select>
        </label>
      )}

      {showPayers && canOwe && (
        <div className="filters__chips">
          <button
            className="filters__chip filters__chip--owed"
            type="button"
            aria-pressed={unpaidOnly}
            onClick={() => onUnpaidChange(!unpaidOnly)}
          >
            {t.receipts.payer.filterUnpaid}
          </button>
        </div>
      )}

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
