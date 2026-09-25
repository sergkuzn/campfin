import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { UsePfand } from '../hooks/usePfand'
import { en } from '../i18n/en'
import { I18nProvider } from '../i18n/I18nProvider'
import { pfandBalances, pfandLedger } from '../lib/pfand'
import type { Expense, PfandEntry } from '../lib/types'
import { PfandScreen } from './PfandScreen'

const t = en.pfand

function expense(fields: Partial<Expense> = {}): Expense {
  return {
    id: 'e1',
    campId: 'c1',
    poolId: 'pool-1',
    name: 'Drinks',
    amountCents: 1900,
    date: '2026-07-14',
    paidBy: 'Ben',
    createdAt: 1000,
    ...fields,
  }
}

function renderScreen(
  options: {
    expenses?: Expense[]
    entries?: PfandEntry[]
    moneyHolder?: string
    readOnly?: boolean
  } = {},
) {
  const { expenses = [], entries = [], moneyHolder = 'Anna', readOnly = false } = options
  const saveEntry = vi.fn()
  const deleteEntry = vi.fn()
  const pfand: UsePfand = {
    entries,
    isLoading: false,
    error: null,
    saveEntry,
    deleteEntry,
  }
  // Derived exactly as the app derives it, so the screen is tested against the same ledger
  // it is handed in production rather than a hand-written stand-in.
  const txns = pfandLedger(expenses, entries, moneyHolder)
  const user = userEvent.setup()
  render(
    <I18nProvider>
      <PfandScreen
        campId="c1"
        pfand={pfand}
        txns={txns}
        balances={pfandBalances(txns)}
        moneyHolder={moneyHolder}
        campWindow={null}
        readOnly={readOnly}
        onBack={vi.fn()}
      />
    </I18nProvider>,
  )
  return { user, saveEntry, deleteEntry }
}

/** Everyone the balances section lists, in the order it lists them. */
function balanceNames(): string[] {
  const heading = screen.getByRole('heading', { name: t.balancesTitle })
  const list = heading.parentElement as HTMLElement
  return within(list)
    .getAllByText((_, el) => el?.className === 'pfand-balance__name')
    .map((el) => el.textContent ?? '')
}

/** The balance card for one person, rather than a ledger line naming them. */
function balanceRow(name: string): HTMLElement {
  const heading = screen.getByRole('heading', { name: t.balancesTitle })
  const list = heading.parentElement as HTMLElement
  return within(list).getByText(name, { exact: false }).closest('li') as HTMLElement
}

describe('PfandScreen', () => {
  it('says nothing is here before any deposit has been recorded', () => {
    renderScreen()
    expect(screen.getByText(t.empty)).toBeInTheDocument()
  })

  it('builds a balance out of receipts nobody typed here', () => {
    renderScreen({ expenses: [expense({ pfandPaidCents: 100 })] })

    expect(within(balanceRow('Ben')).getByText(/^1,00/)).toBeInTheDocument()
    // The line it came from is read-only here: it belongs to the receipt that carries it.
    expect(screen.getByText(new RegExp(t.fromReceipt))).toBeInTheDocument()
  })

  it('nets a return against a purchase on the same person', () => {
    renderScreen({
      expenses: [
        expense({ id: 'e1', pfandPaidCents: 100 }),
        expense({ id: 'e2', pfandPaidCents: 50, pfandReturnedCents: 75 }),
      ],
    })
    expect(within(balanceRow('Ben')).getByText(/^0,75/)).toBeInTheDocument()
  })

  it('marks the money holder and still offers them a refund', () => {
    renderScreen({ expenses: [expense({ paidBy: 'Anna', pfandPaidCents: 100 })] })

    const row = balanceRow('Anna')
    expect(within(row).getByText(t.holderTag('Anna'))).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: t.refundAction })).toBeInTheDocument()
  })

  it('opens the refund form on the whole balance, ready to save', async () => {
    const { user, saveEntry } = renderScreen({ expenses: [expense({ pfandPaidCents: 250 })] })

    await user.click(within(balanceRow('Ben')).getByRole('button', { name: t.refundAction }))
    await user.click(screen.getByRole('button', { name: t.save }))

    expect(saveEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: expect.objectContaining({ payer: 'Ben', amountCents: 250 }),
      }),
    )
  })

  it('offers no way to move a deposit between people — that is a receipt’s Return', () => {
    renderScreen({ expenses: [expense({ pfandPaidCents: 100 })] })

    const row = balanceRow('Ben')
    // Refund is the only action, so paying somebody back and moving their deposit cannot
    // drift apart into two things that have to be remembered separately.
    expect(
      within(row)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual([t.refundAction])
  })

  it('gives a balance below zero no button — the row to fix is elsewhere', () => {
    renderScreen({
      expenses: [expense({ pfandReturnedCents: 100 })],
    })

    const row = balanceRow('Ben')
    expect(within(row).queryByRole('button')).not.toBeInTheDocument()
    expect(within(row).getByText(t.overRefunded)).toBeInTheDocument()
  })

  it('moves a paid-back receipt’s deposit to the holder, saying whose trip it was', () => {
    renderScreen({
      expenses: [expense({ paidBy: 'Ben', reimbursed: true, pfandPaidCents: 100 })],
    })

    // Ben has been paid back in full, so the deposit is Anna's to reclaim — and it is the
    // receipt's flag saying so, with no row of its own to fall out of step with it. Ben
    // leaves the balances entirely: the ledger no longer has a line in his name.
    expect(within(balanceRow('Anna')).getByText(/^1,00/)).toBeInTheDocument()
    expect(balanceNames()).toEqual(['👑 Anna'])
    expect(screen.getByText(new RegExp(t.viaPayer('Ben')))).toBeInTheDocument()
  })

  it('leaves a receipt-derived line read-only wherever its deposit ended up', () => {
    renderScreen({
      expenses: [expense({ paidBy: 'Ben', reimbursed: true, pfandPaidCents: 100 })],
    })

    // The row is Anna's now, but it is still a receipt — editing it means editing the
    // receipt, so offering a menu here would be offering something that cannot work.
    const line = screen.getByText(t.txnKinds.receipt_paid('Drinks')).closest('li') as HTMLElement
    expect(within(line).queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('the pfand form', () => {
  const outOfPocket = [
    expense({ id: 'e1', paidBy: 'Ben', pfandPaidCents: 100 }),
    expense({ id: 'e2', paidBy: 'Cara', pfandPaidCents: 50 }),
  ]

  /** Tap Refund on one person's balance — the only way into the form there is. */
  async function openFor(user: ReturnType<typeof renderScreen>['user'], name: string) {
    await user.click(within(balanceRow(name)).getByRole('button', { name: t.refundAction }))
  }

  it('has no way in but a balance row’s Refund', () => {
    renderScreen({ expenses: outOfPocket })
    // Nothing in the header: a refund is always about somebody who is out of pocket, and
    // the only list of those is the one right below it.
    expect(screen.queryByRole('button', { name: /record/i })).not.toBeInTheDocument()
  })

  it('names the person it is about instead of asking', async () => {
    const { user } = renderScreen({ expenses: outOfPocket })
    await openFor(user, 'Cara')

    expect(screen.getByText(t.formTitle('Cara'))).toBeInTheDocument()
    // No name field at all: it came from the row that was tapped, and typing over it would
    // mean the card and the balance above it disagreed.
    expect(screen.queryByRole('textbox', { name: /whose/i })).not.toBeInTheDocument()
  })

  it('saves against that person, prefilled with their whole balance', async () => {
    const { user, saveEntry } = renderScreen({ expenses: outOfPocket })
    await openFor(user, 'Cara')
    await user.click(screen.getByRole('button', { name: t.save }))

    expect(saveEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: expect.objectContaining({ payer: 'Cara', amountCents: 50 }),
      }),
    )
  })

  it('takes a partial amount over the prefilled one', async () => {
    const { user, saveEntry } = renderScreen({ expenses: outOfPocket })
    await openFor(user, 'Ben')

    const amount = screen.getByLabelText(t.amountLabel, { exact: false })
    await user.clear(amount)
    await user.type(amount, '0,25')
    await user.click(screen.getByRole('button', { name: t.save }))

    expect(saveEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: expect.objectContaining({ payer: 'Ben', amountCents: 25 }),
      }),
    )
  })

  it('asks nothing but the date, the amount and a note', async () => {
    const { user } = renderScreen({ expenses: outOfPocket })
    await openFor(user, 'Ben')

    // One kind, one person, so there is nothing left to choose and nothing to explain.
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /mean/i })).not.toBeInTheDocument()
  })
})

describe('PfandScreen — read-only', () => {
  const refund: PfandEntry = {
    id: 'p1',
    campId: 'c1',
    kind: 'refund',
    payer: 'Ben',
    amountCents: 50,
    date: '2026-07-15',
    createdAt: 2000,
  }

  it('shows the balances and the ledger without Refund or a row menu', () => {
    renderScreen({
      readOnly: true,
      expenses: [expense({ pfandPaidCents: 100 })],
      entries: [refund],
    })

    expect(within(balanceRow('Ben')).getByText(/^0,50/)).toBeInTheDocument()
    expect(screen.getByText(t.txnKinds.refund)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t.refundAction })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: en.rowMenu.open('Ben') })).not.toBeInTheDocument()
  })
})
