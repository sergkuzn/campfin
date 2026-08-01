import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/en'
import { I18nProvider } from '../i18n/I18nProvider'
import { JoinCodeCard } from './JoinCodeCard'

/** What `navigator.clipboard` should be for one test; `null` means "not there at all",
 *  which is how a browser outside a secure context behaves. */
type Clipboard = { writeText: (text: string) => Promise<void> } | null

function renderCard(clipboard: Clipboard) {
  // userEvent.setup() installs a clipboard stub of its own, so ours has to be put in
  // place afterwards or it gets overwritten.
  const user = userEvent.setup()
  if (clipboard === null) Reflect.deleteProperty(navigator, 'clipboard')
  else Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true })

  render(
    <I18nProvider>
      <JoinCodeCard joinCode="MOOR-7F3K" memberCount={2} />
    </I18nProvider>,
  )
  return { user, button: screen.getByRole('button', { name: /MOOR-7F3K/ }) }
}

describe('JoinCodeCard', () => {
  it('copies the code and says so', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    const { user, button } = renderCard({ writeText })

    await user.click(button)

    expect(writeText).toHaveBeenCalledExactlyOnceWith('MOOR-7F3K')
    expect(screen.getByText(en.share.copied)).toBeInTheDocument()
  })

  it('explains itself when the clipboard is unavailable', async () => {
    const { user, button } = renderCard(null)

    await user.click(button)

    expect(screen.getByRole('alert')).toHaveTextContent(en.share.copyFailed)
    expect(screen.queryByText(en.share.copied)).not.toBeInTheDocument()
  })

  it('reports a rejected write as a failure rather than a copy', async () => {
    const { user, button } = renderCard({ writeText: () => Promise.reject(new Error('denied')) })

    await user.click(button)

    expect(screen.getByRole('alert')).toHaveTextContent(en.share.copyFailed)
    expect(screen.queryByText(en.share.copied)).not.toBeInTheDocument()
  })

  it('shows the code and the leader count', () => {
    renderCard(null)

    expect(screen.getByText('MOOR-7F3K')).toBeInTheDocument()
    expect(screen.getByText(en.share.members(2))).toBeInTheDocument()
  })
})
