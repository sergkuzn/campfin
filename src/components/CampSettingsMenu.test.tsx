import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/en'
import { I18nProvider } from '../i18n/I18nProvider'
import { CampSettingsMenu } from './CampSettingsMenu'

const t = en.dashboard.settings

/** Every component under test reads its strings from the context, so it needs the
 *  provider — a bare render would throw by design. */
function renderMenu(props: Partial<React.ComponentProps<typeof CampSettingsMenu>> = {}) {
  const onRename = vi.fn()
  const onDelete = vi.fn()
  render(
    <I18nProvider>
      <CampSettingsMenu
        campName="Moorwerder"
        canDelete
        onRename={onRename}
        onDelete={onDelete}
        {...props}
      />
    </I18nProvider>,
  )
  return { onRename, onDelete, user: userEvent.setup() }
}

const openMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: t.open }))
}

describe('CampSettingsMenu', () => {
  it('keeps its items hidden until the gear is tapped', async () => {
    const { user } = renderMenu()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    await openMenu(user)
    expect(screen.getByRole('menuitem', { name: t.rename })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: t.delete })).toBeInTheDocument()
  })

  it('offers delete only to an admin', async () => {
    const { user } = renderMenu({ canDelete: false })
    await openMenu(user)

    expect(screen.getByRole('menuitem', { name: t.rename })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: t.delete })).not.toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const { user } = renderMenu()
    await openMenu(user)

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes when something outside it is clicked', async () => {
    const { user } = renderMenu()
    await openMenu(user)

    await user.click(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('renames with the trimmed name and closes the dialog', async () => {
    const { user, onRename } = renderMenu()
    await openMenu(user)
    await user.click(screen.getByRole('menuitem', { name: t.rename }))

    const input = screen.getByLabelText(t.renameLabel)
    // The field starts on the current name, so a small edit does not mean retyping it.
    expect(input).toHaveValue('Moorwerder')

    await user.clear(input)
    await user.type(input, '  Moorwerder 2027  ')
    await user.click(screen.getByRole('button', { name: t.save }))

    expect(onRename).toHaveBeenCalledExactlyOnceWith('Moorwerder 2027')
    // A closed <dialog> keeps its content in the DOM, so "gone" means not visible.
    expect(screen.getByLabelText(t.renameLabel)).not.toBeVisible()
  })

  it('cannot save a blank name', async () => {
    const { user, onRename } = renderMenu()
    await openMenu(user)
    await user.click(screen.getByRole('menuitem', { name: t.rename }))

    await user.clear(screen.getByLabelText(t.renameLabel))
    expect(screen.getByRole('button', { name: t.save })).toBeDisabled()
    expect(onRename).not.toHaveBeenCalled()
  })

  it('drops a cancelled edit instead of carrying it into the next one', async () => {
    const { user, onRename } = renderMenu()
    await openMenu(user)
    await user.click(screen.getByRole('menuitem', { name: t.rename }))
    await user.type(screen.getByLabelText(t.renameLabel), ' scrapped')
    await user.click(screen.getByRole('button', { name: en.confirm.cancel }))
    expect(onRename).not.toHaveBeenCalled()

    await openMenu(user)
    await user.click(screen.getByRole('menuitem', { name: t.rename }))
    expect(screen.getByLabelText(t.renameLabel)).toHaveValue('Moorwerder')
  })

  it('deletes only after the confirmation is accepted', async () => {
    const { user, onDelete } = renderMenu()
    await openMenu(user)
    await user.click(screen.getByRole('menuitem', { name: t.delete }))

    // The question names the camp, so the button never deletes an unnamed "it".
    expect(screen.getByText(t.deleteConfirm('Moorwerder'))).toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: t.deleteConfirmLabel }))
    expect(onDelete).toHaveBeenCalledOnce()
  })
})
