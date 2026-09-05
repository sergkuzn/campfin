import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/en'
import { I18nProvider } from '../i18n/I18nProvider'
import type { PoolSummary } from '../lib/pools'
import { buildReport } from '../lib/report'
import { computeSettlement } from '../lib/settlement'
import type { Camp, Expense, Movement, OtherExpense } from '../lib/types'
import { FinancialReport } from './FinancialReport'

const camp: Camp = {
  id: 'c1',
  name: 'Moorwerder',
  joinCode: 'MOOR-7F3K',
  moneyHolder: 'Anna',
  createdAt: 1_700_000_000_000,
}

const summaries: PoolSummary[] = [
  {
    pool: { id: 'pool-e', campId: 'c1', name: 'Group money', role: 'everyday', createdAt: 1 },
    sources: [
      {
        id: 's1',
        campId: 'c1',
        poolId: 'pool-e',
        kind: 'fixed',
        name: 'Group allowance',
        amountCents: 30_000,
        createdAt: 1,
      },
    ],
    fundedCents: 30_000,
    entitledCents: 30_000,
    unusableCents: 0,
    spentCents: 12_000,
    remainingCents: 18_000,
  },
]

const expenses: Expense[] = [
  {
    id: 'e1',
    campId: 'c1',
    poolId: 'pool-e',
    name: 'Bread',
    amountCents: 12_000,
    date: '2026-07-02',
    number: 3,
    createdAt: 2,
  },
]

const movements: Movement[] = [
  {
    id: 'v1',
    campId: 'c1',
    kind: 'volunteer_in',
    name: 'Alex',
    amountCents: 3000,
    date: '2026-07-02',
    createdAt: 3,
  },
]

const otherExpense: OtherExpense = {
  id: 'o1',
  campId: 'c1',
  name: 'Tent pole',
  amountCents: 2490,
  date: '2026-07-04',
  paidBy: 'Ben',
  createdAt: 4,
}

/** Renders the screen. `onExportCsv` comes back so a caller can read the file it produced. */
function renderReport(otherExpenses: OtherExpense[] = [], includeOther = true) {
  const onExportCsv = vi.fn()
  const user = userEvent.setup()
  render(
    <I18nProvider>
      <FinancialReport
        camp={camp}
        report={buildReport({
          summaries,
          blocks: [],
          expenses,
          movements,
          otherExpenses,
          includeOther,
        })}
        settlement={computeSettlement({
          summaries,
          blocks: [],
          expenses,
          movements,
          otherExpenses,
          pfandEntries: [],
        })}
        expenses={expenses}
        summaries={summaries}
        hasOtherExpenses={otherExpenses.length > 0}
        includeOther={includeOther}
        onIncludeOtherChange={vi.fn()}
        onBack={vi.fn()}
        onExportCsv={onExportCsv}
      />
    </I18nProvider>,
  )

  return { user, onExportCsv }
}

/** Renders the screen and hands back the CSV the export button produces. */
async function exportCsv(otherExpenses: OtherExpense[] = [], includeOther = true): Promise<string> {
  const { user, onExportCsv } = renderReport(otherExpenses, includeOther)

  await user.click(screen.getByRole('button', { name: en.report.exportCsv }))
  return onExportCsv.mock.calls[0]?.[0] ?? ''
}

describe('the financial report CSV', () => {
  it('carries all three tables with their totals', async () => {
    const csv = await exportCsv()

    expect(csv).toContain(`${en.report.income.total};330,00`) // 30000 granted + 3000 in fees
    expect(csv).toContain(`${en.report.expenses.total};120,00`)
    expect(csv).toContain(`${en.report.difference.total};210,00`)
  })

  it('itemises the receipts under the tables', async () => {
    const csv = await exportCsv()

    expect(csv).toContain(en.report.csv.receiptsTitle)
    expect(csv).toContain('3;2026-07-02;Group money;Bread;120,00')
  })

  it('counts out-of-pocket spending in the expense total and itemises it', async () => {
    const csv = await exportCsv([otherExpense])

    // Listed one at a time under the group heading, with no subtotal of their own.
    expect(csv).toContain(`${en.report.expenses.other}\r\nTent pole;24,90`)
    expect(csv).toContain(`${en.report.expenses.total};144,90`) // 120,00 of receipts on top
    expect(csv).toContain(en.report.csv.otherTitle)
    expect(csv).toContain(`2026-07-04;Tent pole;24,90;;Ben;${en.report.csv.repaidNo}`)
  })

  it('leaves it out of the file entirely when the switch is off', async () => {
    const csv = await exportCsv([otherExpense], false)

    expect(csv).not.toContain(en.report.csv.otherTitle)
    expect(csv).toContain(`${en.report.expenses.total};120,00`)
  })
})

describe('the other-expenses switch', () => {
  const t = en.report.expenses

  it('appears only once there is something for it to count', () => {
    renderReport([])
    // A control that can change nothing is worse than no control at all.
    expect(screen.queryByRole('checkbox', { name: t.includeOther })).toBeNull()
  })

  it('keeps what it does behind the ⓘ until it is asked for', async () => {
    const { user } = renderReport([otherExpense])

    expect(screen.getByRole('checkbox', { name: t.includeOther })).toBeInTheDocument()
    expect(screen.queryByText(t.includeOtherHint)).toBeNull()

    await user.click(screen.getByRole('button', { name: t.includeOtherInfo }))
    expect(screen.getByText(t.includeOtherHint)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: t.includeOtherInfo }))
    expect(screen.queryByText(t.includeOtherHint)).toBeNull()
  })
})
