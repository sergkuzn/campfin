import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/en'
import { I18nProvider } from '../i18n/I18nProvider'
import { UpdateToast } from './UpdateToast'

function renderToast(show: boolean) {
  const user = userEvent.setup()
  const onReload = vi.fn()
  const onDismiss = vi.fn()

  render(
    <I18nProvider>
      <UpdateToast show={show} onReload={onReload} onDismiss={onDismiss} />
    </I18nProvider>,
  )
  return { user, onReload, onDismiss }
}

describe('UpdateToast', () => {
  it('stays out of the way while no update is waiting', () => {
    renderToast(false)

    expect(screen.queryByText(en.update.available)).not.toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toEqual([])
    // The live region itself stays mounted so the toast is announced when it arrives.
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('announces a waiting update', () => {
    renderToast(true)

    expect(screen.getByRole('status')).toHaveTextContent(en.update.available)
  })

  it('takes the update only when asked', async () => {
    const { user, onReload, onDismiss } = renderToast(true)

    await user.click(screen.getByRole('button', { name: en.update.reload }))

    expect(onReload).toHaveBeenCalledOnce()
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('dismisses without reloading', async () => {
    const { user, onReload, onDismiss } = renderToast(true)

    await user.click(screen.getByRole('button', { name: en.update.dismiss }))

    expect(onDismiss).toHaveBeenCalledOnce()
    expect(onReload).not.toHaveBeenCalled()
  })
})
