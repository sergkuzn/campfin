import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { en } from '../i18n/en'
import { I18nProvider } from '../i18n/I18nProvider'
import { THEME_STORAGE_KEY } from '../lib/theme'
import { ThemeToggle } from './ThemeToggle'

function renderToggle() {
  const user = userEvent.setup()
  render(
    <I18nProvider>
      <ThemeToggle />
    </I18nProvider>,
  )
  return user
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    // The attribute survives between tests in one jsdom document, so clear it too.
    delete document.documentElement.dataset.theme
  })

  it('opens in day mode when nothing has been chosen', () => {
    renderToggle()

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(screen.getByRole('button', { name: en.theme.switchToDark })).toBeInTheDocument()
  })

  it('switches to night mode and remembers the choice', async () => {
    const user = renderToggle()

    await user.click(screen.getByRole('button', { name: en.theme.switchToDark }))

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    // The label now offers the way back, which is what the icon shows.
    expect(screen.getByRole('button', { name: en.theme.switchToLight })).toBeInTheDocument()
  })

  it('opens in night mode when that is what was stored', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    renderToggle()

    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('switches back to day mode on a second tap', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    const user = renderToggle()

    await user.click(screen.getByRole('button', { name: en.theme.switchToLight }))

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  })
})
