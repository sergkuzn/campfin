import { describe, expect, it } from 'vitest'
import { formatVersion, parseAppEnv } from './version'

describe('formatVersion', () => {
  it('joins version, commit and build date', () => {
    expect(
      formatVersion({ version: '0.1.0', commit: '1a2b3c4', builtAt: '2026-08-01', env: 'prod' }),
    ).toBe('v0.1.0 · 1a2b3c4 · 2026-08-01')
  })
  it('drops the commit when git was unavailable', () => {
    expect(
      formatVersion({ version: '0.1.0', commit: '', builtAt: '2026-08-01', env: 'prod' }),
    ).toBe('v0.1.0 · 2026-08-01')
  })
  it('leaves no stray separator when only the version is known', () => {
    expect(formatVersion({ version: '0.1.0', commit: '', builtAt: '', env: 'prod' })).toBe('v0.1.0')
  })
  it('returns an empty string when nothing is known', () => {
    expect(formatVersion({ version: '', commit: '', builtAt: '', env: 'prod' })).toBe('')
  })
  it('leads with the environment on a test build', () => {
    expect(
      formatVersion({ version: '0.1.0', commit: '1a2b3c4', builtAt: '2026-08-01', env: 'test' }),
    ).toBe('test · v0.1.0 · 1a2b3c4 · 2026-08-01')
  })
  it('still names the environment when the build knows nothing else', () => {
    expect(formatVersion({ version: '', commit: '', builtAt: '', env: 'test' })).toBe('test')
  })
})

describe('parseAppEnv', () => {
  it('accepts the production label', () => {
    expect(parseAppEnv('prod')).toBe('prod')
  })
  it('treats an unset label as a test build', () => {
    expect(parseAppEnv(undefined)).toBe('test')
  })
  it('treats an unrecognised label as a test build', () => {
    expect(parseAppEnv('production')).toBe('test')
    expect(parseAppEnv('')).toBe('test')
  })
})
