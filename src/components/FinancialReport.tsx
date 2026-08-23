import './FinancialReport.css'
import { useFormat, useT } from '../i18n'
import { csvAmount, toCsv } from '../lib/csv'
import { sourceLabel } from '../lib/income'
import { isSamePayer } from '../lib/payers'
import type { PoolSummary } from '../lib/pools'
import type { DifferenceLine, FinancialReport as Report } from '../lib/report'
import type { Settlement, SettlementWarning } from '../lib/settlement'
import type { Camp, Expense } from '../lib/types'

type Props = {
  camp: Camp
  /** The three tables, computed by the parent from the same summaries the bars read. */
  report: Report
  /** What actually goes back, floored per pool — its warnings sit under the difference. */
  settlement: Settlement
  /** Every receipt, for the itemised half of the CSV. */
  expenses: Expense[]
  summaries: PoolSummary[]
  onBack: () => void
  /** The parent owns the filename and the download; this screen owns the content. */
  onExportCsv: (text: string) => void
}

/**
 * The end-of-camp report: income, expenses, and a difference table that explains the gap
 * between them line by line — plus the checks that would make the number premature, and the
 * two ways off the phone.
 */
export function FinancialReport({
  camp,
  report,
  settlement,
  expenses,
  summaries,
  onBack,
  onExportCsv,
}: Props) {
  const t = useT()
  const format = useFormat()

  // Difference kinds are *codes*; the sentences live in the dictionary. A switch with no
  // default is what makes a future kind a compile error here instead of a blank cell.
  const differenceLabel = (line: DifferenceLine): string => {
    const pool = line.pool?.name ?? ''
    switch (line.kind) {
      case 'pool_unspent':
        return t.report.difference.rows.poolUnspent(pool)
      case 'pool_unusable':
        return t.report.difference.rows.poolUnusable(pool)
      case 'deposit_return':
        return t.report.difference.rows.depositReturn(pool)
      case 'fee':
        return t.report.difference.rows.fee
      case 'orphan_spent':
        return t.report.difference.rows.orphanSpent
    }
  }

  const warningText = (warning: SettlementWarning): string => {
    const amount = format.euros(warning.amountCents)
    // Narrowing on `kind` is what makes the right fields visible in each branch: the payer
    // warning has a name and no pool, the other three have a pool and no name.
    if (warning.kind === 'owed_to_payer') {
      return t.settlement.warnings.owedToPayer(warning.payerName, amount)
    }

    const pool = warning.pool?.name ?? ''
    switch (warning.kind) {
      case 'deposit_at_vendor':
        return t.settlement.warnings.depositAtVendor(pool, amount)
      case 'pool_overspent':
        return t.settlement.warnings.poolOverspent(pool, amount)
      case 'over_attended':
        return t.settlement.warnings.overAttended(pool, amount)
    }
  }

  /** A key that tells two warnings of the same kind apart — by pool, or by person. */
  const warningKey = (warning: SettlementWarning): string =>
    warning.kind === 'owed_to_payer'
      ? `owed_to_payer-${warning.payerName}`
      : `${warning.kind}-${warning.pool?.id ?? 'none'}`

  /**
   * The Repaid column, in the three states a reader needs to tell apart: yes, no while it
   * is still owed, and blank when there was nothing to pay back — either nobody was
   * tracked, or the money holder paid it out of their own cash anyway.
   */
  const repaidCell = (expense: Expense): string => {
    if (expense.paidBy === undefined || isSamePayer(expense.paidBy, camp.moneyHolder)) return ''
    return expense.reimbursed === true ? t.report.csv.repaidYes : t.report.csv.repaidNo
  }

  const handleExportCsv = () => {
    const poolNames = new Map(summaries.map((s) => [s.pool.id, s.pool.name]))

    onExportCsv(
      toCsv([
        // The three tables in the order they are read on screen, blank rows between them,
        // then the receipts they were derived from — one file, one attachment.
        [t.report.income.title],
        [t.report.csv.item, t.report.csv.amount],
        [t.report.income.advance],
        ...report.advance.map((line) => [
          sourceLabel(line.source, line.pool),
          csvAmount(line.amountCents),
        ]),
        [t.report.income.advanceTotal, csvAmount(report.advanceTotalCents)],
        ...(report.fee === null
          ? []
          : [
              [t.report.income.fee],
              ...report.fee.payments.map((payment) => [
                payment.name,
                csvAmount(payment.amountCents),
              ]),
              [t.report.income.feeTotal, csvAmount(report.fee.totalCents)],
            ]),
        [t.report.income.total, csvAmount(report.incomeTotalCents)],

        [],
        [t.report.expenses.title],
        [t.report.csv.item, t.report.csv.amount],
        ...report.expenses.map((line) => [
          line.pool?.name ?? t.report.expenses.unknownPool,
          csvAmount(line.spentCents),
        ]),
        [t.report.expenses.total, csvAmount(report.expenseTotalCents)],

        [],
        [t.report.difference.title],
        [t.report.csv.item, t.report.csv.amount],
        ...report.difference.map((line) => [differenceLabel(line), csvAmount(line.amountCents)]),
        [t.report.difference.total, csvAmount(report.differenceCents)],

        [],
        [t.report.csv.receiptsTitle],
        [
          t.report.csv.number,
          t.report.csv.date,
          t.report.csv.pool,
          t.report.csv.name,
          t.report.csv.amount,
          t.report.csv.note,
          t.report.csv.paidBy,
          t.report.csv.repaid,
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
            expense.paidBy ?? '',
            // Three answers in one column: "yes" once it is paid back, "no" while it is
            // still owed, and empty when nobody fronted the money.
            repaidCell(expense),
          ]),
      ]),
    )
  }

  return (
    <div className="report">
      <button className="screen-back report__hide-print" type="button" onClick={onBack}>
        {t.report.back}
      </button>

      <header className="report__header">
        <h2 className="report__title">{t.report.title}</h2>
        <p className="report__camp">{camp.name}</p>
      </header>

      <section className="report__section">
        <h3 className="report__section-title">{t.report.income.title}</h3>
        {report.advance.length === 0 && report.fee === null ? (
          <p className="report__empty">{t.report.income.empty}</p>
        ) : (
          <table className="report__table">
            <thead>
              <tr>
                <th scope="col">{t.report.columnItem}</th>
                <th scope="col" className="report__amount">
                  {t.report.columnAmount}
                </th>
              </tr>
            </thead>
            <tbody>
              {/* One group per heading, so the browser keeps "Cash advance" with the rows it
                  introduces instead of breaking the page between them. */}
              <tr className="report__group">
                <th scope="rowgroup" colSpan={2}>
                  {t.report.income.advance}
                </th>
              </tr>
              {report.advance.map((line) => (
                <tr key={line.source.id}>
                  <td>{sourceLabel(line.source, line.pool)}</td>
                  <td className="report__amount">{format.euros(line.amountCents)}</td>
                </tr>
              ))}
              <tr className="report__subtotal">
                <th scope="row">{t.report.income.advanceTotal}</th>
                <td className="report__amount">{format.euros(report.advanceTotalCents)}</td>
              </tr>

              {/* Left off entirely when no fee was collected — an empty section on a report
                  reads as a number someone forgot to fill in. */}
              {report.fee !== null && (
                <>
                  <tr className="report__group">
                    <th scope="rowgroup" colSpan={2}>
                      {t.report.income.fee}
                    </th>
                  </tr>
                  {report.fee.payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{payment.name}</td>
                      <td className="report__amount">{format.euros(payment.amountCents)}</td>
                    </tr>
                  ))}
                  <tr className="report__subtotal">
                    <th scope="row">{t.report.income.feeTotal}</th>
                    <td className="report__amount">{format.euros(report.fee.totalCents)}</td>
                  </tr>
                </>
              )}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">{t.report.income.total}</th>
                <td className="report__amount">{format.euros(report.incomeTotalCents)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      <section className="report__section">
        <h3 className="report__section-title">{t.report.expenses.title}</h3>
        {report.expenses.length === 0 ? (
          <p className="report__empty">{t.report.expenses.empty}</p>
        ) : (
          <table className="report__table">
            <thead>
              <tr>
                <th scope="col">{t.report.columnItem}</th>
                <th scope="col" className="report__amount">
                  {t.report.columnAmount}
                </th>
              </tr>
            </thead>
            <tbody>
              {report.expenses.map((line) => (
                <tr key={line.pool?.id ?? 'none'}>
                  <td>{line.pool?.name ?? t.report.expenses.unknownPool}</td>
                  <td className="report__amount">{format.euros(line.spentCents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">{t.report.expenses.total}</th>
                <td className="report__amount">{format.euros(report.expenseTotalCents)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      <section className="report__section">
        <h3 className="report__section-title">{t.report.difference.title}</h3>
        {report.difference.length === 0 ? (
          <p className="report__empty">{t.report.difference.empty}</p>
        ) : (
          <table className="report__table">
            <thead>
              <tr>
                <th scope="col">{t.report.columnItem}</th>
                <th scope="col" className="report__amount">
                  {t.report.columnAmount}
                </th>
              </tr>
            </thead>
            <tbody>
              {report.difference.map((line) => (
                // One line per kind per pool, so the pair is a stable identity — no index keys.
                <tr key={`${line.kind}-${line.pool?.id ?? 'none'}`}>
                  <td>{differenceLabel(line)}</td>
                  <td className="report__amount">{format.euros(line.amountCents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">{t.report.difference.total}</th>
                <td className="report__amount">{format.euros(report.differenceCents)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      {settlement.warnings.length > 0 && (
        <section className="report__warnings">
          <h3 className="report__warnings-title">{t.settlement.warningsTitle}</h3>
          <ul className="report__warning-list">
            {settlement.warnings.map((warning) => (
              <li key={warningKey(warning)}>{warningText(warning)}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="report__actions report__hide-print">
        <button className="report__action" type="button" onClick={handleExportCsv}>
          {t.report.exportCsv}
        </button>
        {/* The browser's own print dialog also saves as PDF, which is what a separate PDF
            export would have been for. */}
        <button className="report__action" type="button" onClick={() => window.print()}>
          {t.report.print}
        </button>
      </div>

      {/* Printed too: the report leaves the phone as a document, and the caveat travels
          with it. */}
      <p className="report__disclaimer">{t.report.disclaimer}</p>
    </div>
  )
}
