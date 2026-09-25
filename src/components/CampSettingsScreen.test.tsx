import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/en'
import { I18nProvider } from '../i18n/I18nProvider'
import type { PoolSummary } from '../lib/pools'
import type { Camp, Expense } from '../lib/types'
import { viewUntilFor } from '../lib/viewAccess'
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
  const onOpenViewLink = vi.fn()
  const onSetViewUntil = vi.fn()
  const onCloseViewLink = vi.fn()
  const user = userEvent.setup()
  render(
    <I18nProvider>
      <CampSettingsScreen
        camp={camp}
        summaries={[summary]}
        memberCount={2}
        campWindow={null}
        isAdmin
        isLoading={false}
        error={null}
        expenses={[]}
        onBack={onBack}
        onOpenIncome={onOpenIncome}
        onRename={onRename}
        onChangeHolder={onChangeHolder}
        onOpenViewLink={onOpenViewLink}
        onSetViewUntil={onSetViewUntil}
        onCloseViewLink={onCloseViewLink}
        onDelete={onDelete}
        {...props}
      />
    </I18nProvider>,
  )
  return {
    onRename,
    onDelete,
    onOpenIncome,
    onBack,
    onChangeHolder,
    onOpenViewLink,
    onSetViewUntil,
    onCloseViewLink,
    user,
  }
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

  it('deletes only after the camp name is typed and the confirmation is accepted', async () => {
    const { user, onDelete } = renderScreen()
    await user.click(screen.getByRole('button', { name: t.delete }))

    // The question names the camp, so the button never deletes an unnamed "it".
    expect(screen.getByText(t.deleteConfirm('Moorwerder'))).toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()

    // A GitHub-style guard: the button stays disabled until the name is typed back.
    const deleteButton = screen.getByRole('button', { name: t.deleteConfirmLabel })
    expect(deleteButton).toBeDisabled()

    await user.type(screen.getByLabelText(t.deleteTypeLabel('Moorwerder')), 'Moorwerder')
    expect(deleteButton).toBeEnabled()

    await user.click(deleteButton)
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('keeps the delete button disabled for a name that does not match', async () => {
    const { user, onDelete } = renderScreen()
    await user.click(screen.getByRole('button', { name: t.delete }))

    // Case-sensitive, like GitHub's own repo-delete guard.
    await user.type(screen.getByLabelText(t.deleteTypeLabel('Moorwerder')), 'moorwerder')

    expect(screen.getByRole('button', { name: t.deleteConfirmLabel })).toBeDisabled()
    expect(onDelete).not.toHaveBeenCalled()
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

  it('explains the join code behind an ⓘ', async () => {
    const { user } = renderScreen()

    await user.click(screen.getByRole('button', { name: t.shareInfoLabel }))
    expect(screen.getByText(t.shareInfo)).toBeInTheDocument()
  })

  describe('participant link', () => {
    const v = en.viewLink
    const span = { startIso: '2027-07-01', endIso: '2027-07-10' }
    // Far enough ahead that the link is open whenever the suite runs.
    const openCamp = {
      ...camp,
      viewCode: 'ABCDEFGHJKLMNPQR',
      viewUntil: viewUntilFor('2999-07-10'),
    }

    it("creates a link that ends on the camp's last day", async () => {
      const { user, onOpenViewLink } = renderScreen({ campWindow: span })

      await user.click(screen.getByRole('button', { name: v.create }))
      expect(onOpenViewLink).toHaveBeenCalledExactlyOnceWith('2027-07-10')
    })

    it('explains itself behind an ⓘ, folded until asked', async () => {
      const { user } = renderScreen()

      expect(screen.queryByText(v.info)).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: v.infoLabel }))
      expect(screen.getByText(v.info)).toBeInTheDocument()
    })

    it('cannot create one before anything dates the camp', () => {
      renderScreen({ campWindow: null })

      expect(screen.getByRole('button', { name: v.create })).toBeDisabled()
      expect(screen.getByText(v.needsDates)).toBeInTheDocument()
    })

    it('shows an open link with its code and its end', () => {
      renderScreen({ camp: openCamp, campWindow: span })

      expect(screen.getByText(/\?view=ABCDEFGHJKLMNPQR$/)).toBeInTheDocument()
      expect(screen.getByText(/^Works until/)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: v.create })).not.toBeInTheDocument()
    })

    it('says so once the link has run out', () => {
      renderScreen({
        camp: { ...camp, viewCode: 'ABCDEFGHJKLMNPQR', viewUntil: viewUntilFor('2020-01-01') },
      })

      expect(screen.getByText(/^Stopped working after/)).toBeInTheDocument()
    })

    it('offers to catch up with a camp that grew past the link', async () => {
      const { user, onSetViewUntil } = renderScreen({
        camp: { ...camp, viewCode: 'ABCDEFGHJKLMNPQR', viewUntil: viewUntilFor('2027-07-08') },
        campWindow: span,
      })

      await user.click(screen.getByRole('button', { name: /^Extend to/ }))
      expect(onSetViewUntil).toHaveBeenCalledExactlyOnceWith('2027-07-10')
    })

    it('turns the link off only after asking', async () => {
      const { user, onCloseViewLink } = renderScreen({ camp: openCamp, campWindow: span })

      await user.click(screen.getByRole('button', { name: v.close }))
      expect(onCloseViewLink).not.toHaveBeenCalled()
      await user.click(screen.getByRole('button', { name: v.closeConfirm }))
      expect(onCloseViewLink).toHaveBeenCalledOnce()
    })
  })
})
