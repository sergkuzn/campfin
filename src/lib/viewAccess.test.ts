import { describe, expect, it } from 'vitest'
import { CODE_ALPHABET } from './joinCode'
import type { Camp } from './types'
import {
  endsBeforeCamp,
  generateViewCode,
  isViewCode,
  lastViewDay,
  VIEW_CODE_LENGTH,
  viewAccess,
  viewCodeFromSearch,
  viewLink,
  viewUntilFor,
} from './viewAccess'

const camp = (fields: Partial<Camp> = {}): Camp => ({
  id: 'c1',
  name: 'Moorwerder',
  joinCode: 'MOOR-7F3K',
  createdAt: 1,
  ...fields,
})

describe('generateViewCode', () => {
  it('is sixteen alphabet characters', () => {
    const code = generateViewCode(Math.random)
    expect(code).toHaveLength(VIEW_CODE_LENGTH)
    expect(isViewCode(code)).toBe(true)
  })
  it('walks the alphabet with the injected randoms', () => {
    // index = floor(r * 32), so 0 → the first character and 31/32 → the last.
    const values = [0, 31 / 32]
    let i = 0
    const code = generateViewCode(() => values[i++ % values.length] ?? 0)
    expect(code).toBe(`${CODE_ALPHABET[0]}${CODE_ALPHABET[31]}`.repeat(8))
  })
})

describe('isViewCode', () => {
  it('rejects the wrong length', () => {
    expect(isViewCode('ABCD')).toBe(false)
    expect(isViewCode('')).toBe(false)
  })
  it('rejects characters outside the alphabet', () => {
    // O and 0 are left out of the alphabet on purpose, so a code containing one is mangled.
    expect(isViewCode('ABCDEFGHJKLMNPQO')).toBe(false)
    expect(isViewCode('abcdefghjklmnpqr')).toBe(false)
  })
})

describe('viewCodeFromSearch', () => {
  it('reads the code and uppercases it', () => {
    expect(viewCodeFromSearch('?view=abcdefghjklmnpqr')).toBe('ABCDEFGHJKLMNPQR')
  })
  it('is null on an ordinary page', () => {
    expect(viewCodeFromSearch('')).toBeNull()
    expect(viewCodeFromSearch('?other=1')).toBeNull()
  })
  it('round-trips a generated link', () => {
    const code = generateViewCode(Math.random)
    const url = new URL(viewLink('https://campfin.example', code))
    expect(viewCodeFromSearch(url.search)).toBe(code)
  })
})

describe('viewUntilFor / lastViewDay', () => {
  it('ends access at local midnight after the last day', () => {
    expect(viewUntilFor('2026-08-12')).toBe(new Date(2026, 7, 13).getTime())
  })
  it('rolls over the end of a month and a year', () => {
    expect(viewUntilFor('2026-07-31')).toBe(new Date(2026, 7, 1).getTime())
    expect(viewUntilFor('2026-12-31')).toBe(new Date(2027, 0, 1).getTime())
  })
  it('gives back the day it was built from', () => {
    for (const day of ['2026-08-12', '2026-07-31', '2026-12-31', '2026-03-29']) {
      expect(lastViewDay(viewUntilFor(day))).toBe(day)
    }
  })
})

describe('viewAccess', () => {
  const until = viewUntilFor('2026-08-12')

  it('is off without a code', () => {
    expect(viewAccess(camp(), 0)).toEqual({ state: 'off' })
  })
  it('is off when only half the pair is stored', () => {
    expect(viewAccess(camp({ viewCode: 'ABCDEFGHJKLMNPQR' }), 0)).toEqual({ state: 'off' })
    expect(viewAccess(camp({ viewUntil: until }), 0)).toEqual({ state: 'off' })
  })
  it('is open up to the last moment of the last day', () => {
    const access = viewAccess(camp({ viewCode: 'ABCDEFGHJKLMNPQR', viewUntil: until }), until - 1)
    expect(access).toEqual({ state: 'open', code: 'ABCDEFGHJKLMNPQR', lastDayIso: '2026-08-12' })
  })
  it('is closed from midnight on', () => {
    const stored = camp({ viewCode: 'ABCDEFGHJKLMNPQR', viewUntil: until })
    expect(viewAccess(stored, until).state).toBe('closed')
    expect(viewAccess(stored, until + 86_400_000).state).toBe('closed')
  })
})

describe('endsBeforeCamp', () => {
  it('flags a link that stops before the camp does', () => {
    expect(endsBeforeCamp('2026-08-10', '2026-08-12')).toBe(true)
  })
  it('is fine on the last day itself and after it', () => {
    expect(endsBeforeCamp('2026-08-12', '2026-08-12')).toBe(false)
    expect(endsBeforeCamp('2026-08-15', '2026-08-12')).toBe(false)
  })
})
