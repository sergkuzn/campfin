import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/en'
import { I18nProvider } from '../i18n/I18nProvider'
import type { PoolSummary } from '../lib/pools'
import type { Camp, Expense } from '../lib/types'
import { CampSettingsScreen } from './CampSettingsScreen'

const t = en.campSettings
/** The income card's accessible name runs its title, the hidden line naming the
 *  destination, and every figure inside it together — so match on the part that says
 *  where the card leads. */
const incomeCard = new RegExp(en.dashboard.setUpIncome.replace('→', ''))

const camp: Camp = {
  id: 'c1',
  name: 'Moorwerder',
  joinCode: 'MOOR-7F3K',
  createdAt: 1_700_000_000_000,
}

const summary: PoolSummary = {
  pool: { id: 'pool-e', campId: 'c1', name: 'Group money', role: 'everyday', createdAt: 1 },
  sources: [
    {
      id: 's1',
      campId: 'c1',
      poolId: 'pool-e',
      kind: 'fixed',
      name: 'Grant',
      amountCents: 30_000,
      createdAt: 1,
    },
  ],
  fundedCents: 30_000,
  entitledCents: 30_000,
  unusableCents: 0,
  spentCents: 0,
  remainingCents: 30_000,
}

/** A receipt someone other than the holder paid and nobody has paid back yet. */
const paidByBen: Expense = {
  id: 'e1',
  campId: 'c1',
  poolId: 'pool-e',
  name: 'Rope',
  date: '2027-07-02',
  amountCents: 1_250,
  createdAt: 2,
  paidBy: 'Ben',
}

/** Every component under test reads its strings from the context, so it needs the
 *  provider — a bare render would throw by design. */
function renderScreen(props: Partial<React.ComponentProps<typeof CampSettingsScreen>> = {}) {
  const onRename = vi.fn()
  const onDelete = vi.fn()
  const onOpenIncome = vi.fn()
  const onBack = vi.fn()
  const onChangeHolder = vi.fn()
  const user = userEvent.setup()
  render(
    <I18nProvider>
      <CampSettingsScreen
        camp={camp}
        summaries={[summary]}
        memberCount={2}
        isAdmin
        isLoading={false}
        error={null}
        expenses={[]}
        onBack={onBack}
        onOpenIncome={onOpenIncome}
        onRename={onRename}
        onChangeHolder={onChangeHolder}
        onDelete={onDelete}
        {...props}
      />
    </I18nProvider>,
  )
  return { onRename, onDelete, onOpenIncome, onBack, onChangeHolder, user }
}

describe('CampSettingsScreen', () => {
  it('renames with the trimmed name', async () => {
    const { user, onRename } = renderScreen()
    const input = screen.getByLabelText(t.nameLabel)
    // The field starts on the current name, so a small edit does not mean retyping it.
    expect(input).toHaveValue('Moorwerder')

    await user.clear(input)
    await user.type(input, '  Moorwerder 2027  ')
    await user.click(screen.getByRole('button', { name: t.save }))

    expect(onRename).toHaveBeenCalledExactlyOnceWith('Moorwerder 2027')
  })

  it('cannot save a blank name', async () => {
    const { user, onRename } = renderScreen()
    await user.clear(screen.getByLabelText(t.nameLabel))

    expect(screen.getByRole('button', { name: t.save })).toBeDisabled()
    expect(onRename).not.toHaveBeenCalled()
  })

  it('cannot save the name it already has', () => {
    renderScreen()
    // Nothing was typed, so Save would write the same string it read — offering it would
    // promise a change that isn't there.
    expect(screen.getByRole('button', { name: t.save })).toBeDisabled()
  })

  it('deletes only after the confirmation is accepted', async () => {
    const { user, onDelete } = renderScreen()
    await user.click(screen.getByRole('button', { name: t.delete }))

    // The question names the camp, so the button never deletes an unnamed "it".
    expect(screen.getByText(t.deleteConfirm('Moorwerder'))).toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: t.deleteConfirmLabel }))
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('drops a delete that was cancelled', async () => {
    const { user, onDelete } = renderScreen()
    await user.click(screen.getByRole('button', { name: t.delete }))
    await user.click(screen.getByRole('button', { name: en.confirm.cancel }))

    expect(onDelete).not.toHaveBeenCalled()
    // A closed <dialog> keeps its content in the DOM, so "gone" means not visible.
    expect(screen.getByText(t.deleteConfirm('Moorwerder'))).not.toBeVisible()
  })

  it('offers no danger zone to a non-admin', () => {
    renderScreen({ isAdmin: false })

    expect(screen.queryByRole('button', { name: t.delete })).not.toBeInTheDocument()
    expect(screen.queryByText(t.dangerSection)).not.toBeInTheDocument()
  })

  it('shows the join code and the income that arrived', () => {
    renderScreen()

    expect(screen.getByRole('button', { name: /MOOR-7F3K/ })).toBeInTheDocument()
    expect(screen.getByText(en.share.members(2))).toBeInTheDocument()
    // The received block moved here off the dashboard, link and all.
    expect(screen.getByText('Group money')).toBeInTheDocument()
  })

  it('opens the income screen from the income card', async () => {
    const { user, onOpenIncome } = renderScreen()
    // The whole card is the button — there is no separate link inside it.
    await user.click(screen.getByRole('button', { name: incomeCard }))

    expect(onOpenIncome).toHaveBeenCalledOnce()
  })

  describe('money holder', () => {
    it('states that nobody holds the money', () => {
      renderScreen()

      expect(screen.getByText(t.holderNone)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: t.holderSet })).toBeInTheDocument()
    })

    it('offers no list of the other people the receipts name', async () => {
      const { user } = renderScreen({
        camp: { ...camp, moneyHolder: 'Anna' },
        expenses: [paidByBen],
      })
      await user.click(screen.getByRole('button', { name: t.holderChange }))

      // The field is a free-text box, not a picker: Ben paid a receipt but is not offered.
      expect(screen.queryByRole('option', { name: 'Ben' })).not.toBeInTheDocument()
      expect(screen.getByLabelText(t.holderNewNameLabel)).toHaveValue('')
    })

    it('names a new holder once the change is confirmed', async () => {
      const { user, onChangeHolder } = renderScreen({
        camp: { ...camp, moneyHolder: 'Anna' },
        expenses: [paidByBen],
      })
      await user.click(screen.getByRole('button', { name: t.holderChange }))
      await user.type(screen.getByLabelText(t.holderNewNameLabel), '  Ben  ')
      await user.click(screen.getByRole('button', { name: t.holderSave }))

      // Ben's receipt stops being owed, because Ben would now hold the money himself.
      expect(screen.getByText(t.holderStopOwing(1))).toBeInTheDocument()
      expect(onChangeHolder).not.toHaveBeenCalled()

      await user.click(screen.getByRole('button', { name: t.holderConfirm }))
      expect(onChangeHolder).toHaveBeenCalledExactlyOnceWith('Ben')
    })

    it('offers only a hand-over — the money can never be held by nobody', () => {
      renderScreen({ camp: { ...camp, moneyHolder: 'Anna' } })

      // Every "owed" marker is measured against the holder, so a camp past setup always
      // has one: the only thing settings can do is name somebody else.
      expect(screen.getByRole('button', { name: t.holderChange })).toBeInTheDocument()
      const buttons = screen.getAllByRole('button').map((button) => button.textContent)
      expect(buttons.filter((label) => label?.match(/remove|clear|nobody/i))).toEqual([])
    })

    it('does not list who is still to be paid back', () => {
      renderScreen({ camp: { ...camp, moneyHolder: 'Anna' }, expenses: [paidByBen] })

      // That list belongs to the settlement sheet; settings only says who holds the cash.
      expect(screen.queryByText('Ben', { exact: false })).not.toBeInTheDocument()
    })
  })
})
