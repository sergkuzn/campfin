import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/en'
import { I18nProvider } from '../i18n/I18nProvider'
import type { PoolSummary } from '../lib/pools'
import type { Camp } from '../lib/types'
import { CampSettingsScreen } from './CampSettingsScreen'

const t = en.campSettings

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

/** Every component under test reads its strings from the context, so it needs the
 *  provider — a bare render would throw by design. */
function renderScreen(props: Partial<React.ComponentProps<typeof CampSettingsScreen>> = {}) {
  const onRename = vi.fn()
  const onDelete = vi.fn()
  const onOpenIncome = vi.fn()
  const onBack = vi.fn()
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
        onBack={onBack}
        onOpenIncome={onOpenIncome}
        onRename={onRename}
        onDelete={onDelete}
        {...props}
      />
    </I18nProvider>,
  )
  return { onRename, onDelete, onOpenIncome, onBack, user }
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
    expect(screen.getByRole('button', { name: en.dashboard.setUpIncome })).toBeInTheDocument()
  })

  it('opens the income screen from the income section', async () => {
    const { user, onOpenIncome } = renderScreen()
    await user.click(screen.getByRole('button', { name: en.dashboard.setUpIncome }))

    expect(onOpenIncome).toHaveBeenCalledOnce()
  })
})
