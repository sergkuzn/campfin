import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME, otherTheme, parseTheme, themeColor } from './theme'

describe('parseTheme', () => {
  it('reads back both stored themes', () => {
    expect(parseTheme('light')).toBe('light')
    expect(parseTheme('dark')).toBe('dark')
  })

  it('falls back to the default when nothing has been stored', () => {
    expect(parseTheme(null)).toBe(DEFAULT_THEME)
  })

  it('falls back to the default for a value it does not recognise', () => {
    // An older build, a hand-edited key, or an empty string must not reach the DOM.
    expect(parseTheme('system')).toBe(DEFAULT_THEME)
    expect(parseTheme('')).toBe(DEFAULT_THEME)
    expect(parseTheme('Dark')).toBe(DEFAULT_THEME)
  })

  it('defaults to light, so a phone in night mode still opens the app in day mode', () => {
    expect(DEFAULT_THEME).toBe('light')
  })
})

describe('otherTheme', () => {
  it('swaps the two themes', () => {
    expect(otherTheme('light')).toBe('dark')
    expect(otherTheme('dark')).toBe('light')
  })

  it('returns to where it started after two taps', () => {
    expect(otherTheme(otherTheme('light'))).toBe('light')
  })
})

describe('themeColor', () => {
  it('gives each theme its own browser-chrome colour', () => {
    expect(themeColor('light')).not.toBe(themeColor('dark'))
  })
})
