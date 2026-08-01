import { describe, expect, it } from 'vitest'
import { formatVersion } from './version'

describe('formatVersion', () => {
  it('joins version, commit and build date', () => {
    expect(formatVersion({ version: '0.1.0', commit: '1a2b3c4', builtAt: '2026-08-01' })).toBe(
      'v0.1.0 · 1a2b3c4 · 2026-08-01',
    )
  })
  it('drops the commit when git was unavailable', () => {
    expect(formatVersion({ version: '0.1.0', commit: '', builtAt: '2026-08-01' })).toBe(
      'v0.1.0 · 2026-08-01',
    )
  })
  it('leaves no stray separator when only the version is known', () => {
    expect(formatVersion({ version: '0.1.0', commit: '', builtAt: '' })).toBe('v0.1.0')
  })
  it('returns an empty string when nothing is known', () => {
    expect(formatVersion({ version: '', commit: '', builtAt: '' })).toBe('')
  })
})
