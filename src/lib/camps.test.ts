import { describe, expect, it } from 'vitest'
import { campNameExists, campStatus, isCamp, sortCampsByRecent } from './camps'
import type { Camp } from './types'

const camp = (over: Partial<Camp> = {}): Camp => ({
  id: 'c1',
  name: 'Moorwerder',
  joinCode: 'MOOR-7F3K',
  createdAt: 1_700_000_000_000,
  ...over,
})

describe('isCamp', () => {
  it('accepts a minimal camp', () => {
    expect(isCamp({ id: 'A', name: 'B', joinCode: 'AAAA-1234', createdAt: 1 })).toBe(true)
  })
  it('accepts a camp with a window', () => {
    expect(
      isCamp({
        id: 'A',
        name: 'B',
        joinCode: 'AAAA-1234',
        createdAt: 1,
        startDate: '2026-07-01',
        endDate: '2026-07-14',
      }),
    ).toBe(true)
  })
  it('rejects a camp without a join code', () => {
    expect(isCamp({ id: 'A', name: 'B', createdAt: 1 })).toBe(false)
  })
  it('rejects null', () => {
    expect(isCamp(null)).toBe(false)
  })
  it('rejects non-objects', () => {
    expect(isCamp('MOOR-7F3K')).toBe(false)
    expect(isCamp(42)).toBe(false)
    expect(isCamp(undefined)).toBe(false)
  })
  it('rejects a missing field', () => {
    expect(isCamp({ id: 'A', name: 'B' })).toBe(false)
  })
  it('rejects a wrongly-typed field', () => {
    expect(isCamp({ id: 'A', name: 'B', joinCode: 'AAAA-1234', createdAt: '1' })).toBe(false)
  })
  it('rejects a wrongly-typed optional field', () => {
    expect(
      isCamp({ id: 'A', name: 'B', joinCode: 'AAAA-1234', createdAt: 1, startDate: 20260701 }),
    ).toBe(false)
  })
})

describe('sortCampsByRecent', () => {
  const older = camp({ id: 'OLD', createdAt: 1 })
  const newer = camp({ id: 'NEW', createdAt: 2 })

  it('puts the newest first', () => {
    expect(sortCampsByRecent([older, newer]).map((c) => c.id)).toEqual(['NEW', 'OLD'])
  })
  it('does not mutate its argument', () => {
    const input = [older, newer]
    sortCampsByRecent(input)
    expect(input.map((c) => c.id)).toEqual(['OLD', 'NEW'])
  })
  it('handles an empty list', () => {
    expect(sortCampsByRecent([])).toEqual([])
  })
})

describe('campNameExists', () => {
  const moor = camp({ id: 'MOOR-1', name: 'Moorwerder' })
  const wald = camp({ id: 'WALD-1', name: 'Waldcamp' })

  it('is true when another camp already has the name', () => {
    expect(campNameExists([moor, wald], 'Waldcamp')).toBe(true)
  })
  it('is false for a fresh name', () => {
    expect(campNameExists([moor, wald], 'Seecamp')).toBe(false)
  })
  it('ignores the camp being renamed, so it can keep its own name', () => {
    expect(campNameExists([moor, wald], 'Moorwerder', 'MOOR-1')).toBe(false)
  })
  it('still catches a collision with a different camp when renaming', () => {
    expect(campNameExists([moor, wald], 'Waldcamp', 'MOOR-1')).toBe(true)
  })
})

describe('campStatus', () => {
  const dated = camp({ startDate: '2026-07-01', endDate: '2026-07-14' })

  it('is draft with no dates at all', () => {
    expect(campStatus(camp(), '2026-07-05')).toBe('draft')
  })
  it('is draft with only a start date', () => {
    expect(campStatus(camp({ startDate: '2026-07-01' }), '2026-07-05')).toBe('draft')
  })
  it('is upcoming before the start', () => {
    expect(campStatus(dated, '2026-06-30')).toBe('upcoming')
  })
  it('is running on the first day', () => {
    expect(campStatus(dated, '2026-07-01')).toBe('running')
  })
  it('is running in the middle', () => {
    expect(campStatus(dated, '2026-07-07')).toBe('running')
  })
  it('is running on the last day (endDate is inclusive)', () => {
    expect(campStatus(dated, '2026-07-14')).toBe('running')
  })
  it('is finished the day after', () => {
    expect(campStatus(dated, '2026-07-15')).toBe('finished')
  })
})
