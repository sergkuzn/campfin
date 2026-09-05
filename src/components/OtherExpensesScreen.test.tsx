import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { UseOtherExpenses } from '../hooks/useOtherExpenses'
import { en } from '../i18n/en'
import { I18nProvider } from '../i18n/I18nProvider'
import type { OtherExpense } from '../lib/types'
import { OtherExpensesScreen } from './OtherExpensesScreen'

const t = en.otherExpenses

function expense(fields: Partial<OtherExpense> & { id: string }): OtherExpense {
  return {
    campId: 'c1',
    name: 'Tent pole',
    amountCents: 2490,
    date: '2026-07-14',
    paidBy: 'Anna',
    createdAt: 1000,
    ...fields,
  }
}

function renderScreen(options: { expenses?: OtherExpense[]; moneyHolder?: string } = {}): {
  user: ReturnType<typeof userEvent.setup>
  saveOtherExpense: ReturnType<typeof vi.fn>
  setReimbursed: ReturnType<typeof vi.fn>
  deleteOtherExpense: ReturnType<typeof vi.fn>
} {
  const { expenses = [], moneyHolder = 'Anna' } = options
  const saveOtherExpense = vi.fn()
  const setReimbursed = vi.fn()
  const deleteOtherExpense = vi.fn()
  const stub: UseOtherExpenses = {
    otherExpenses: expenses,
    isLoading: false,
    error: null,
    saveOtherExpense,
    setReimbursed,
    deleteOtherExpense,
  }
  const user = userEvent.setup()
  render(
    <I18nProvider>
      <OtherExpensesScreen
        campId="c1"
        moneyHolder={moneyHolder}
        campWindow={null}
        otherExpenses={stub}
        onBack={vi.fn()}
      />
    </I18nProvider>,
  )
  return { user, saveOtherExpense, setReimbursed, deleteOtherExpense }
}

/** A required field's label carries a red star, so match the label text as a prefix. */
function labelled(label: string): HTMLElement {
  return screen.getByLabelText(label, { exact: false })
}

describe('OtherExpensesScreen', () => {
  it('says the list is empty rather than showing a blank screen', () => {
    renderScreen()
    expect(screen.getByText(t.empty)).toBeInTheDocument()
  })

  it('keeps what the screen is for behind the ⓘ until it is asked for', async () => {
    const { user } = renderScreen()

    expect(screen.queryByText(t.hint)).toBeNull()

    await user.click(screen.getByRole('button', { name: t.infoLabel }))
    expect(screen.getByText(t.hint)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: t.infoLabel }))
    expect(screen.queryByText(t.hint)).toBeNull()
  })

  it('totals what the organisation owes back, settled rows included', () => {
    renderScreen({
      expenses: [
        expense({ id: 'a', amountCents: 2490 }),
        expense({ id: 'b', amountCents: 1010, paidBy: 'Ben', reimbursed: true }),
      ],
    })

    expect(screen.getByText('35,00 €')).toBeInTheDocument()
  })

  it('saves a new expense with the amount in cents', async () => {
    const { user, saveOtherExpense } = renderScreen()

    await user.click(screen.getByRole('button', { name: t.add }))
    await user.type(labelled(t.nameLabel), 'Tent pole')
    await user.type(labelled(t.amountLabel), '24,90')
    await user.click(screen.getByRole('radio', { name: en.receipts.payer.holderOption('Anna') }))
    await user.click(screen.getByRole('button', { name: t.save }))

    expect(saveOtherExpense).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Tent pole', amountCents: 2490, paidBy: 'Anna' }),
    )
  })

  it('blocks the save until whose money it was is answered', async () => {
    const { user, saveOtherExpense } = renderScreen()

    await user.click(screen.getByRole('button', { name: t.add }))
    await user.type(labelled(t.nameLabel), 'Tent pole')
    await user.type(labelled(t.amountLabel), '24,90')

    expect(screen.getByRole('button', { name: t.save })).toBeDisabled()
    expect(saveOtherExpense).not.toHaveBeenCalled()
  })

  it('offers no return button on a row the money holder paid themselves', () => {
    renderScreen({ expenses: [expense({ id: 'a', paidBy: 'Anna' })] })

    // There is nobody for them to settle with — only the organisation, which is off-app.
    expect(screen.queryByRole('button', { name: en.receipts.payer.returnButton })).toBeNull()
  })

  it('ticks a co-leader off after confirming, and only then', async () => {
    const { user, setReimbursed } = renderScreen({
      expenses: [expense({ id: 'a', paidBy: 'Ben' })],
    })

    await user.click(screen.getByRole('button', { name: en.receipts.payer.returnButton }))
    expect(setReimbursed).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: en.receipts.payer.confirmReturnLabel }))
    expect(setReimbursed).toHaveBeenCalledWith('a', true)
  })
})
