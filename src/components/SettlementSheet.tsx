import './SettlementSheet.css'
import { useFormat, useT } from '../i18n'
import { csvAmount, toCsv } from '../lib/csv'
import type { PoolSummary } from '../lib/pools'
import type { Settlement, SettlementRow, SettlementWarning } from '../lib/settlement'
import type { Camp, Expense } from '../lib/types'

type Props = {
  camp: Camp
  /** Computed by the parent from the same summaries the bars and the chart read. */
  settlement: Settlement
  /** Every receipt, for the itemised half of the CSV. */
  expenses: Expense[]
  summaries: PoolSummary[]
  onBack: () => void
  onExportJson: () => void
  /** The parent owns the filename and the download; this screen owns the content. */
  onExportCsv: (text: string) => void
}

/**
 * The end-of-camp sheet: a table that explains "to return €X" line by line, the warnings
 * that would make that number premature, and the three ways off the phone.
 */
export function SettlementSheet({
  camp,
  settlement,
  expenses,
  summaries,
  onBack,
  onExportJson,
  onExportCsv,
}: Props) {
  const t = useT()
  const format = useFormat()

  // Row and warning kinds are *codes*; the sentences live in the dictionary. A switch with
  // no default is what makes a future kind a compile error here instead of a blank cell.
  const rowLabel = (row: SettlementRow): string => {
    const pool = row.pool?.name ?? ''
    switch (row.kind) {
      case 'pool_unspent':
        return t.settlement.rows.poolUnspent(pool)
      case 'pool_unusable':
        return t.settlement.rows.poolUnusable(pool)
      case 'deposit_return':
        return t.settlement.rows.depositReturn(pool)
      case 'volunteer':
        return t.settlement.rows.volunteer
    }
  }

  const rowWhy = (row: SettlementRow): string => {
    switch (row.kind) {
      case 'pool_unspent':
        return t.settlement.why.poolUnspent
      case 'pool_unusable':
        return t.settlement.why.poolUnusable
      case 'deposit_return':
        return t.settlement.why.depositReturn
      case 'volunteer':
        return t.settlement.why.volunteer
    }
  }

  const warningText = (warning: SettlementWarning): string => {
    const pool = warning.pool?.name ?? ''
    const amount = format.euros(warning.amountCents)
    switch (warning.kind) {
      case 'deposit_at_vendor':
        return t.settlement.warnings.depositAtVendor(pool, amount)
      case 'pool_overspent':
        return t.settlement.warnings.poolOverspent(pool, amount)
      case 'over_attended':
        return t.settlement.warnings.overAttended(pool, amount)
    }
  }

  const handleExportCsv = () => {
    const poolNames = new Map(summaries.map((s) => [s.pool.id, s.pool.name]))

    onExportCsv(
      toCsv([
        [t.settlement.csv.category, t.settlement.csv.amount, t.settlement.csv.why],
        ...settlement.rows.map((row) => [rowLabel(row), csvAmount(row.amountCents), rowWhy(row)]),
        [t.settlement.total, csvAmount(settlement.toReturnCents), ''],

        // A blank row separates the two sections: the sheet above, the receipts it was
        // derived from below, in one file so accounting opens one attachment.
        [],
        [t.settlement.csv.receiptsTitle],
        [
          t.settlement.csv.number,
          t.settlement.csv.date,
          t.settlement.csv.pool,
          t.settlement.csv.name,
          t.settlement.csv.amount,
          t.settlement.csv.note,
        ],
        // Oldest first, and ISO dates rather than a formatted day: a spreadsheet in any
        // locale reads "2026-07-02" the same way.
        ...expenses
          .toSorted((a, b) => a.date.localeCompare(b.date))
          .map((expense) => [
            // An unnumbered receipt leaves the cell empty rather than inventing a number.
            expense.number === undefined ? '' : String(expense.number),
            expense.date,
            poolNames.get(expense.poolId) ?? t.receipts.unknownPool,
            expense.name,
            csvAmount(expense.amountCents),
            expense.note ?? '',
          ]),
      ]),
    )
  }

  return (
    <div className="settlement">
      <button className="dashboard__back settlement__hide-print" type="button" onClick={onBack}>
        {t.settlement.back}
      </button>

      <header className="settlement__header">
        <h2 className="settlement__title">{t.settlement.title}</h2>
        <p className="settlement__camp">{camp.name}</p>
        <p className="settlement__intro">{t.settlement.intro}</p>
      </header>

      <dl className="settlement__summary">
        <div className="settlement__summary-item">
          <dt>{t.settlement.received}</dt>
          <dd>{format.euros(settlement.receivedTotalCents)}</dd>
        </div>
        <div className="settlement__summary-item">
          <dt>{t.settlement.spent}</dt>
          <dd>{format.euros(settlement.spentTotalCents)}</dd>
        </div>
      </dl>

      {settlement.rows.length === 0 ? (
        <p className="settlement__empty">{t.settlement.empty}</p>
      ) : (
        <table className="settlement__table">
          <thead>
            <tr>
              <th scope="col">{t.settlement.columnCategory}</th>
              <th scope="col" className="settlement__amount">
                {t.settlement.columnAmount}
              </th>
            </tr>
          </thead>
          <tbody>
            {settlement.rows.map((row) => (
              // One row per kind per pool, so the pair is a stable identity — no index keys.
              <tr key={`${row.kind}-${row.pool?.id ?? 'none'}`}>
                <td>
                  <span className="settlement__category">{rowLabel(row)}</span>
                  <span className="settlement__why">{rowWhy(row)}</span>
                </td>
                <td className="settlement__amount">{format.euros(row.amountCents)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">{t.settlement.total}</th>
              <td className="settlement__amount">{format.euros(settlement.toReturnCents)}</td>
            </tr>
          </tfoot>
        </table>
      )}

      {settlement.warnings.length > 0 && (
        <section className="settlement__warnings">
          <h3 className="settlement__warnings-title">{t.settlement.warningsTitle}</h3>
          <ul className="settlement__warning-list">
            {settlement.warnings.map((warning) => (
              <li key={`${warning.kind}-${warning.pool?.id ?? 'none'}`}>{warningText(warning)}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="settlement__actions settlement__hide-print">
        <button className="settlement__action" type="button" onClick={onExportJson}>
          {t.settlement.exportJson}
        </button>
        <button className="settlement__action" type="button" onClick={handleExportCsv}>
          {t.settlement.exportCsv}
        </button>
        {/* The browser's own print dialog also saves as PDF, which is what the plan's
            deferred PDF report was for. */}
        <button className="settlement__action" type="button" onClick={() => window.print()}>
          {t.settlement.print}
        </button>
      </div>
    </div>
  )
}
