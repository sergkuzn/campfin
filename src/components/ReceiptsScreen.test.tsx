import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { UseExpenses } from '../hooks/useExpenses'
import { en } from '../i18n/en'
import { I18nProvider } from '../i18n/I18nProvider'
import { poolColorOf } from '../lib/poolColors'
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
/** Held money, not spendable: the deposits screen settles it, so it must not appear in the
 *  picker or the chips here. */
const busDeposit: Pool = { ...pool('pool-bus', 'Bus deposit'), role: 'deposit' }

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

function renderScreen(
  options: {
    expenses?: Expense[]
    pools?: Pool[]
    focusPoolId?: string | null
    moneyHolder?: string
  } = {},
) {
  const { expenses = rows, pools = [food, tools], focusPoolId = null, moneyHolder } = options
  const saveExpense = vi.fn()
  const setReimbursed = vi.fn()
  const deleteExpense = vi.fn()
  const stub: UseExpenses = {
    expenses,
    isLoading: false,
    error: null,
    saveExpense,
    setReimbursed,
    deleteExpense,
  }
  const user = userEvent.setup()
  render(
    <I18nProvider>
      <ReceiptsScreen
        campId="c1"
        moneyHolder={moneyHolder}
        campWindow={null}
        expenses={stub}
        summaries={pools.map(summary)}
        focusPoolId={focusPoolId}
        onBack={vi.fn()}
        onOpenPfand={vi.fn()}
      />
    </I18nProvider>,
  )
  return { user, saveExpense, setReimbursed, deleteExpense }
}

/** The receipt names in the order they are rendered — the one thing a sort changes. */
/** A required field's label carries a red star, so match the label text as a prefix. */
function labelled(label: string): HTMLElement {
  return screen.getByLabelText(label, { exact: false })
}

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

  it('opens a new receipt on the next free number', async () => {
    const { user } = renderScreen()
    await user.click(screen.getByRole('button', { name: t.add }))
    // The highest in the camp is 2, so the field starts on 3.
    expect(screen.getByLabelText(t.numberLabel)).toHaveValue('3')
  })

  it('refuses to save a number another receipt already carries', async () => {
    const { user, saveExpense } = renderScreen()
    await user.click(screen.getByRole('button', { name: t.add }))

    await user.type(labelled(t.nameLabel), 'Milk')
    await user.type(labelled(t.amountLabel), '3,00')
    await user.clear(screen.getByLabelText(t.numberLabel))
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

  it('moves the unnumbered receipt to the top with the numbers reversed', async () => {
    const { user } = renderScreen()
    await user.selectOptions(screen.getByLabelText(t.sortLabel), 'number_desc')
    expect(renderedNames()).toEqual(['Ferry', 'Bakery', 'Rope'])
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

  it('opens filtered to the pool it was asked to focus', () => {
    renderScreen({ focusPoolId: tools.id })
    expect(renderedNames()).toEqual(['Rope'])
  })

  it('lets the focused pool be switched back off — it is a starting point, not a lock', async () => {
    const { user } = renderScreen({ focusPoolId: tools.id })
    await user.click(screen.getByRole('button', { name: tools.name }))
    expect(renderedNames()).toHaveLength(3)
  })

  it('clears the selection when the last pool is switched on, rather than lighting them all', async () => {
    const { user } = renderScreen()
    await user.click(screen.getByRole('button', { name: food.name }))
    await user.click(screen.getByRole('button', { name: tools.name }))

    // Every pool chosen is the same view as none chosen, so the chips go dark and the
    // "x of y shown" line disappears with them.
    expect(renderedNames()).toHaveLength(3)
    expect(screen.getByRole('button', { name: food.name })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText(t.count(3))).toBeInTheDocument()
  })
})

describe('ReceiptsScreen — deposits stay out', () => {
  it('offers no deposit pool in the picker', async () => {
    const { user } = renderScreen({ pools: [food, tools, busDeposit] })
    await user.click(screen.getByRole('button', { name: t.add }))

    const form = screen.getByRole('button', { name: t.save }).closest('form') as HTMLElement
    expect(within(form).getByRole('button', { name: food.name })).toBeInTheDocument()
    expect(within(form).queryByRole('button', { name: busDeposit.name })).not.toBeInTheDocument()
  })

  it('offers no deposit chip in the filter', () => {
    renderScreen({ pools: [food, tools, busDeposit] })
    expect(screen.queryByRole('button', { name: busDeposit.name })).not.toBeInTheDocument()
  })
})

describe('ReceiptsScreen — how a row wears its pool', () => {
  /** The receipt card carrying the given name, rather than the filter chip of the same name. */
  function rowFor(name: string): HTMLElement {
    return screen.getByText(name).closest('li') as HTMLElement
  }

  it('marks the row with its pool’s colour instead of a named pill', () => {
    renderScreen()
    expect(rowFor('Bakery')).toHaveClass(`pool-tag--${poolColorOf(food)}`)
    expect(rowFor('Rope')).toHaveClass(`pool-tag--${poolColorOf(tools)}`)
  })

  it('keeps the pool name for a screen reader but off the screen', () => {
    renderScreen()
    expect(within(rowFor('Bakery')).getByText(food.name)).toHaveClass('visually-hidden')
  })

  it('spells out a pool that is gone, having no colour left to show it in', () => {
    renderScreen({ expenses: [expense({ id: 'x', name: 'Bakery', poolId: 'pool-deleted' })] })

    const row = screen.getByText('Bakery').closest('li') as HTMLElement
    expect(row.className).not.toMatch(/pool-tag--/)
    expect(within(row).getByText(t.unknownPool)).toBeInTheDocument()
  })
})

describe('ReceiptsScreen — what the money holder owes', () => {
  /** The receipt card carrying the given name. */
  function rowFor(name: string): HTMLElement {
    return screen.getByText(name).closest('li') as HTMLElement
  }

  const owed = expense({ id: 'a', name: 'Bakery', amountCents: 800, paidBy: 'Ben' })
  const holderPaid = expense({ id: 'b', name: 'Rope', paidBy: 'Anna' })

  it('names only the receipts somebody else paid — the holder’s own cost no words', () => {
    renderScreen({ expenses: [owed, holderPaid], moneyHolder: 'Anna' })

    expect(within(rowFor('Bakery')).getByText(t.payer.paidByRow('Ben'))).toBeInTheDocument()
    expect(within(rowFor('Rope')).queryByText(/Paid by/)).not.toBeInTheDocument()
  })

  it('names nobody at all while no holder is set: there is no one to return the money', () => {
    renderScreen({ expenses: [owed] })
    expect(screen.queryByText(t.payer.paidByRow('Ben'))).not.toBeInTheDocument()
  })

  it('returning the money asks first, then writes it — from the list, not the editor', async () => {
    const { user, setReimbursed } = renderScreen({ expenses: [owed], moneyHolder: 'Anna' })

    await user.click(screen.getByRole('button', { name: t.payer.returnButton }))
    expect(setReimbursed).not.toHaveBeenCalled() // the tap alone must not settle anything

    await user.click(screen.getByRole('button', { name: t.payer.confirmReturnLabel }))

    expect(setReimbursed).toHaveBeenCalledWith('a', true)
  })

  it('backing out of that question leaves the receipt owed', async () => {
    const { user, setReimbursed } = renderScreen({ expenses: [owed], moneyHolder: 'Anna' })

    await user.click(screen.getByRole('button', { name: t.payer.returnButton }))
    await user.click(screen.getByRole('button', { name: en.confirm.cancel }))

    expect(setReimbursed).not.toHaveBeenCalled()
  })

  it('undoing a return asks in the same way', async () => {
    const repaid = expense({ id: 'a', name: 'Bakery', paidBy: 'Ben', reimbursed: true })
    const { user, setReimbursed } = renderScreen({ expenses: [repaid], moneyHolder: 'Anna' })

    await user.click(screen.getByRole('button', { name: t.payer.returnedButton }))
    await user.click(screen.getByRole('button', { name: t.payer.confirmUndoLabel }))

    expect(setReimbursed).toHaveBeenCalledWith('a', false)
  })

  it('totals what is still owed under the list', () => {
    renderScreen({ expenses: [owed, holderPaid], moneyHolder: 'Anna' })
    expect(screen.getByText(t.payer.owedTotal)).toBeInTheDocument()
  })

  it('drops that line once nothing is outstanding — "owed 0,00" every day is noise', () => {
    renderScreen({ expenses: [holderPaid], moneyHolder: 'Anna' })
    expect(screen.queryByText(t.payer.owedTotal)).not.toBeInTheDocument()
  })

  it('leaves a receipt with no payer unmarked — an existing camp reads exactly as before', () => {
    renderScreen({ expenses: [expense({ id: 'a', name: 'Bakery' })], moneyHolder: 'Anna' })

    expect(within(rowFor('Bakery')).queryByText(/Paid by/)).not.toBeInTheDocument()
    expect(screen.queryByText(t.payer.owedTotal)).not.toBeInTheDocument()
  })

  it('filters down to what is not repaid yet', async () => {
    const settled = expense({ id: 'c', name: 'Ferry', paidBy: 'Ben', reimbursed: true })
    const { user } = renderScreen({
      expenses: [owed, holderPaid, settled],
      moneyHolder: 'Anna',
    })

    await user.click(screen.getByRole('button', { name: t.payer.filterUnpaid }))

    expect(renderedNames()).toEqual(['Bakery'])
  })
})

describe('ReceiptsScreen — saying whose money it was', () => {
  /** Fill the two fields that are compulsory for reasons other than the payer. */
  async function startReceipt(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: t.add }))
    await user.type(labelled(t.nameLabel), 'Milk')
    await user.type(labelled(t.amountLabel), '3,00')
  }

  it('starts with neither option picked, and will not save until one is', async () => {
    const { user, saveExpense } = renderScreen({ moneyHolder: 'Anna' })
    await startReceipt(user)

    expect(screen.getByRole('radio', { name: t.payer.holderOption('Anna') })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: t.payer.otherOption })).not.toBeChecked()
    expect(screen.getByText(t.issues.paidBy)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.save })).toBeDisabled()
    expect(saveExpense).not.toHaveBeenCalled()
  })

  it('picking the money holder answers it', async () => {
    const { user, saveExpense } = renderScreen({ moneyHolder: 'Anna' })
    await startReceipt(user)

    await user.click(screen.getByRole('radio', { name: t.payer.holderOption('Anna') }))
    await user.click(screen.getByRole('button', { name: t.save }))

    expect(saveExpense).toHaveBeenCalledWith(expect.objectContaining({ paidBy: 'Anna' }))
  })

  it('"someone else" is not an answer until the name is typed', async () => {
    const { user, saveExpense } = renderScreen({ moneyHolder: 'Anna' })
    await startReceipt(user)

    await user.click(screen.getByRole('radio', { name: t.payer.otherOption }))
    expect(screen.getByRole('button', { name: t.save })).toBeDisabled()

    await user.type(screen.getByLabelText(t.payer.newNameLabel), 'Ben')
    await user.click(screen.getByRole('button', { name: t.save }))

    expect(saveExpense).toHaveBeenCalledWith(expect.objectContaining({ paidBy: 'Ben' }))
  })

  it('never asks whether the money is already back — that is the list row’s job', async () => {
    // Settling up moves the payer's pfand with the money, which a checkbox here could not
    // do. Two controls that looked the same and did different things is exactly the
    // confusion this removes.
    const { user } = renderScreen({ moneyHolder: 'Anna' })
    await startReceipt(user)

    await user.click(screen.getByRole('radio', { name: t.payer.otherOption }))
    await user.type(screen.getByLabelText(t.payer.newNameLabel), 'Ben')

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('carries a settled receipt through an edit rather than un-settling it', async () => {
    const settled = expense({ id: 'a', name: 'Bakery', paidBy: 'Ben', reimbursed: true })
    const { user, saveExpense } = renderScreen({ expenses: [settled], moneyHolder: 'Anna' })

    await user.click(screen.getByRole('button', { name: en.rowMenu.open('Bakery') }))
    await user.click(screen.getByRole('button', { name: en.rowMenu.edit }))
    await user.click(screen.getByRole('button', { name: t.save }))

    expect(saveExpense).toHaveBeenCalledWith(expect.objectContaining({ reimbursed: true }))
  })

  it('no money holder set means the only answer is a name', async () => {
    const { user } = renderScreen()
    await startReceipt(user)

    expect(screen.getByText(t.payer.noHolder)).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /holds the camp money/ })).not.toBeInTheDocument()
  })
})

describe('PayerSelect — the two radios stay exclusive', () => {
  it('typing the holder’s own name under "someone else" does not light both', async () => {
    const { user } = renderScreen({ moneyHolder: 'Anna' })
    await user.click(screen.getByRole('button', { name: t.add }))

    await user.click(screen.getByRole('radio', { name: t.payer.otherOption }))
    await user.type(screen.getByLabelText(t.payer.newNameLabel), 'Anna')

    expect(screen.getByRole('radio', { name: t.payer.otherOption })).toBeChecked()
    expect(screen.getByRole('radio', { name: t.payer.holderOption('Anna') })).not.toBeChecked()
    // Nobody can owe themselves, so the settle-up tick stays away.
    expect(screen.queryByRole('checkbox', { name: /Already paid back/ })).not.toBeInTheDocument()
  })

  it('an edited receipt selects the radio its stored payer implies', async () => {
    const { user } = renderScreen({
      expenses: [expense({ id: 'a', name: 'Bakery', paidBy: 'Ben' })],
      moneyHolder: 'Anna',
    })

    await user.click(screen.getByRole('button', { name: en.rowMenu.open('Bakery') }))
    await user.click(screen.getByRole('button', { name: en.rowMenu.edit }))

    expect(screen.getByRole('radio', { name: t.payer.otherOption })).toBeChecked()
    expect(screen.getByLabelText(t.payer.newNameLabel)).toHaveValue('Ben')
  })

  it('a receipt the holder paid leaves the "someone else" name empty', async () => {
    const { user } = renderScreen({
      expenses: [expense({ id: 'a', name: 'Bakery', paidBy: 'Anna' })],
      moneyHolder: 'Anna',
    })

    await user.click(screen.getByRole('button', { name: en.rowMenu.open('Bakery') }))
    await user.click(screen.getByRole('button', { name: en.rowMenu.edit }))

    // The holder's name is what `paidBy` stores, but echoing it in the other-person box
    // would read as a second person who fronted the money.
    expect(screen.getByRole('radio', { name: t.payer.holderOption('Anna') })).toBeChecked()
    expect(screen.getByLabelText(t.payer.newNameLabel)).toHaveValue('')
  })
})

describe('paying somebody back who also fronted pfand', () => {
  /** Ben paid 8,00 € of camp money and 1,00 € of his own deposit on the same slip. */
  const withPfand = expense({
    id: 'a',
    name: 'Bakery',
    amountCents: 800,
    paidBy: 'Ben',
    pfandPaidCents: 100,
    pfandInTotal: true,
  })

  it('shows the pfand on the row without moving the headline amount', () => {
    renderScreen({ expenses: [withPfand], moneyHolder: 'Anna' })

    const row = screen.getByText('Bakery').closest('li') as HTMLElement
    expect(within(row).getByText(/^8,00/)).toBeInTheDocument()
    expect(within(row).getByText(/pfand: \+1,00/)).toBeInTheDocument()
    expect(within(row).getByText(/^total: 9,00/)).toBeInTheDocument()
  })

  it('says where the deposit lands, and moves it with one write', async () => {
    const { user, setReimbursed } = renderScreen({
      expenses: [withPfand],
      moneyHolder: 'Anna',
    })

    await user.click(screen.getByRole('button', { name: t.payer.returnButton }))
    // A statement, not an option: after the return the deposit is the holder's.
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.getByText(/1,00.*moves to Anna/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: t.payer.confirmReturnLabel }))

    // The flag is the whole write: the ledger reads it, so there is no second row to keep
    // in step and nothing that can be left behind.
    expect(setReimbursed).toHaveBeenCalledWith('a', true)
  })

  it('hands the deposit back when the return is undone', async () => {
    const settled = { ...withPfand, reimbursed: true }
    const { user, setReimbursed } = renderScreen({
      expenses: [settled],
      moneyHolder: 'Anna',
    })

    await user.click(screen.getByRole('button', { name: t.payer.returnedButton }))
    expect(screen.getByText(/1,00.*goes back to Ben/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: t.payer.confirmUndoLabel }))
    expect(setReimbursed).toHaveBeenCalledWith('a', false)
  })

  it('names the holder in the delete warning once the receipt has been paid back', async () => {
    const settled = { ...withPfand, reimbursed: true }
    const { user, deleteExpense } = renderScreen({
      expenses: [settled],
      moneyHolder: 'Anna',
    })

    await user.click(screen.getByRole('button', { name: en.rowMenu.open('Bakery') }))
    await user.click(screen.getByRole('button', { name: en.rowMenu.delete }))

    // The balance moving is invisible from this screen, so the question says it first —
    // and it is Anna's balance now, because the return moved the deposit to her.
    expect(screen.getByText(/Anna's pfand balance changes by/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: t.confirmDelete }))
    expect(deleteExpense).toHaveBeenCalledWith('a')
  })

  it('names the payer in the delete warning while the receipt is still owed', async () => {
    const { user } = renderScreen({ expenses: [withPfand], moneyHolder: 'Anna' })

    await user.click(screen.getByRole('button', { name: en.rowMenu.open('Bakery') }))
    await user.click(screen.getByRole('button', { name: en.rowMenu.delete }))

    expect(screen.getByText(/Ben's pfand balance changes by/)).toBeInTheDocument()
  })

  it('names no pfand on a receipt that never had any', async () => {
    const plain = expense({ id: 'a', name: 'Bakery', amountCents: 800, paidBy: 'Ben' })
    const { user } = renderScreen({ expenses: [plain], moneyHolder: 'Anna' })

    await user.click(screen.getByRole('button', { name: en.rowMenu.open('Bakery') }))
    await user.click(screen.getByRole('button', { name: en.rowMenu.delete }))

    expect(within(screen.getByRole('dialog')).queryByText(/pfand/i)).not.toBeInTheDocument()
  })

  it('says nothing about a deposit when the receipt carries none', async () => {
    const plain = expense({ id: 'a', name: 'Bakery', amountCents: 800, paidBy: 'Ben' })
    const { user, setReimbursed } = renderScreen({
      expenses: [plain],
      moneyHolder: 'Anna',
    })

    await user.click(screen.getByRole('button', { name: t.payer.returnButton }))
    expect(within(screen.getByRole('dialog')).queryByText(/pfand/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: t.payer.confirmReturnLabel }))
    expect(setReimbursed).toHaveBeenCalledWith('a', true)
  })
})
