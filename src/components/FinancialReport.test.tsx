import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/en'
import { I18nProvider } from '../i18n/I18nProvider'
import type { PoolSummary } from '../lib/pools'
import { buildReport } from '../lib/report'
import { computeSettlement } from '../lib/settlement'
import type { Camp, Expense, Movement } from '../lib/types'
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

/** Renders the screen and hands back the CSV the export button produces. */
async function exportCsv(): Promise<string> {
  const onExportCsv = vi.fn()
  const user = userEvent.setup()
  render(
    <I18nProvider>
      <FinancialReport
        camp={camp}
        report={buildReport({ summaries, blocks: [], expenses, movements })}
        settlement={computeSettlement({
          summaries,
          blocks: [],
          expenses,
          movements,
          pfandEntries: [],
        })}
        expenses={expenses}
        summaries={summaries}
        onBack={vi.fn()}
        onExportCsv={onExportCsv}
      />
    </I18nProvider>,
  )

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
})
