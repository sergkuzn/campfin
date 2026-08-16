import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { UseExpenses } from '../hooks/useExpenses'
import { en } from '../i18n/en'
import { I18nProvider } from '../i18n/I18nProvider'
import type { PoolSummary } from '../lib/pools'
import type { Expense, Pool } from '../lib/types'
import { ReceiptsScreen } from './ReceiptsScreen'

const t = en.receipts

function pool(id: string, name: string): Pool {
  return { id, campId: 'c1', name, role: 'earmarked', createdAt: 1 }
}

function summary(p: Pool): PoolSummary {
  return {
    pool: p,
    sources: [],
    fundedCents: 50_000,
    entitledCents: 50_000,
    unusableCents: 0,
    spentCents: 0,
    remainingCents: 50_000,
  }
}

const food = pool('pool-food', 'Group money')
const tools = pool('pool-tools', 'Tools')

function expense(fields: Partial<Expense> & { id: string }): Expense {
  return {
    campId: 'c1',
    poolId: food.id,
    name: 'Bakery',
    amountCents: 800,
    date: '2026-07-14',
    createdAt: 1000,
    ...fields,
  }
}

const rows = [
  expense({ id: 'a', name: 'Bakery', number: 2, date: '2026-07-14', poolId: food.id }),
  expense({ id: 'b', name: 'Rope', number: 1, date: '2026-07-15', poolId: tools.id }),
  expense({ id: 'c', name: 'Ferry', date: '2026-07-16', poolId: food.id }),
]

function renderScreen(expenses: Expense[] = rows) {
  const saveExpense = vi.fn()
  const stub: UseExpenses = {
    expenses,
    isLoading: false,
    error: null,
    saveExpense,
    deleteExpense: vi.fn(),
  }
  const user = userEvent.setup()
  render(
    <I18nProvider>
      <ReceiptsScreen
        campId="c1"
        expenses={stub}
        summaries={[summary(food), summary(tools)]}
        onBack={vi.fn()}
      />
    </I18nProvider>,
  )
  return { user, saveExpense }
}

/** The receipt names in the order they are rendered — the one thing a sort changes. */
function renderedNames(): string[] {
  return screen
    .getAllByRole('listitem')
    .map((row) => within(row).getByText(/Bakery|Rope|Ferry/).textContent ?? '')
}

describe('ReceiptsScreen — numbers', () => {
  it('shows a receipt’s number next to its name', () => {
    renderScreen()
    expect(screen.getByText(t.numberTag(2))).toBeInTheDocument()
  })

  it('offers the next free number in the form', async () => {
    const { user } = renderScreen()
    await user.click(screen.getByRole('button', { name: t.add }))
    // The highest in the camp is 2, so the button offers 3.
    expect(screen.getByRole('button', { name: t.numberSuggest(3) })).toBeInTheDocument()
  })

  it('refuses to save a number another receipt already carries', async () => {
    const { user, saveExpense } = renderScreen()
    await user.click(screen.getByRole('button', { name: t.add }))

    await user.type(screen.getByLabelText(t.nameLabel), 'Milk')
    await user.type(screen.getByLabelText(t.amountLabel), '3,00')
    await user.type(screen.getByLabelText(t.numberLabel), '1')

    expect(screen.getByText(t.issues.numberTaken)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.save })).toBeDisabled()
    expect(saveExpense).not.toHaveBeenCalled()
  })
})

describe('ReceiptsScreen — sorting', () => {
  it('lists the newest day first to begin with', () => {
    renderScreen()
    expect(renderedNames()).toEqual(['Ferry', 'Rope', 'Bakery'])
  })

  it('sorts by number with the unnumbered receipt last', async () => {
    const { user } = renderScreen()
    await user.selectOptions(screen.getByLabelText(t.sortLabel), 'number_asc')
    expect(renderedNames()).toEqual(['Rope', 'Bakery', 'Ferry'])
  })

  it('keeps the unnumbered receipt last with the numbers reversed', async () => {
    const { user } = renderScreen()
    await user.selectOptions(screen.getByLabelText(t.sortLabel), 'number_desc')
    expect(renderedNames()).toEqual(['Bakery', 'Rope', 'Ferry'])
  })
})

describe('ReceiptsScreen — pool filter', () => {
  it('shows only the chosen pool’s receipts', async () => {
    const { user } = renderScreen()
    await user.click(screen.getByRole('button', { name: tools.name }))
    expect(renderedNames()).toEqual(['Rope'])
  })

  it('goes back to everything when the last chip is switched off', async () => {
    const { user } = renderScreen()
    const chip = screen.getByRole('button', { name: tools.name })
    await user.click(chip)
    await user.click(chip)
    expect(renderedNames()).toHaveLength(3)
  })

  it('says how many receipts the filter is hiding', async () => {
    const { user } = renderScreen()
    await user.click(screen.getByRole('button', { name: tools.name }))
    expect(screen.getByText(t.filterCount(1, 3))).toBeInTheDocument()
  })
})
