import { describe, expect, it } from 'vitest'
import {
  type CampWindow,
  campNameExists,
  campStatus,
  campWindow,
  hasMoneyHolder,
  isCamp,
  isCampSetUp,
  sortCampsByRecent,
  uniqueCampName,
} from './camps'
import type { Camp, PerDiemBlock } from './types'

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
  it('ignores fields it does not know, so an older export still reads', () => {
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
})

describe('isCampSetUp', () => {
  const held = camp({ moneyHolder: 'Anna' })

  it('needs both a holder and income', () => {
    expect(isCampSetUp(held, true)).toBe(true)
  })
  it('is not set up while nobody holds the money', () => {
    expect(isCampSetUp(camp(), true)).toBe(false)
  })
  it('is not set up while there is no income', () => {
    expect(isCampSetUp(held, false)).toBe(false)
  })
  it('treats a blank holder as no holder — a name of spaces names nobody', () => {
    expect(isCampSetUp(camp({ moneyHolder: '   ' }), true)).toBe(false)
    expect(hasMoneyHolder(camp({ moneyHolder: '' }))).toBe(false)
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

describe('uniqueCampName', () => {
  const moor = camp({ id: 'MOOR-1', name: 'Moorwerder' })
  const moor2 = camp({ id: 'MOOR-2', name: 'Moorwerder (2)' })

  it('leaves a free name alone', () => {
    expect(uniqueCampName([moor], 'Waldcamp')).toBe('Waldcamp')
  })
  it('suffixes a taken name', () => {
    expect(uniqueCampName([moor], 'Moorwerder')).toBe('Moorwerder (2)')
  })
  it('keeps counting past a suffix that is taken too', () => {
    expect(uniqueCampName([moor, moor2], 'Moorwerder')).toBe('Moorwerder (3)')
  })
  it('has nothing to avoid in an empty list', () => {
    expect(uniqueCampName([], 'Moorwerder')).toBe('Moorwerder')
  })
})

describe('campWindow', () => {
  const block = (over: Partial<PerDiemBlock>): PerDiemBlock => ({
    id: 'b1',
    campId: 'c1',
    sourceId: 'pd',
    variant: 'granted',
    numPersons: 4,
    ratePerPersonDayCents: 800,
    startDate: '2026-07-01',
    endDate: '2026-07-03',
    ...over,
  })

  it('spans a single block', () => {
    expect(campWindow([block({})])).toEqual({ startIso: '2026-07-01', endIso: '2026-07-03' })
  })
  it('spans the outermost dates of several blocks', () => {
    const blocks = [
      block({ id: 'b1', startDate: '2026-07-05', endDate: '2026-07-09' }),
      block({ id: 'b2', startDate: '2026-07-02', endDate: '2026-07-06' }),
    ]
    expect(campWindow(blocks)).toEqual({ startIso: '2026-07-02', endIso: '2026-07-09' })
  })
  it('is null with no blocks at all', () => {
    expect(campWindow([])).toBeNull()
  })
  it('is null when a block ends before it starts', () => {
    expect(campWindow([block({ startDate: '2026-07-10', endDate: '2026-07-01' })])).toBeNull()
  })
  it('follows the actual blocks once a source has them', () => {
    const blocks = [
      block({ id: 'b1', startDate: '2026-07-01', endDate: '2026-07-10' }),
      block({ id: 'b2', variant: 'actual', startDate: '2026-07-03', endDate: '2026-07-08' }),
    ]
    expect(campWindow(blocks)).toEqual({ startIso: '2026-07-03', endIso: '2026-07-08' })
  })
  it('keeps each source on its own variant', () => {
    const blocks = [
      block({ id: 'a1', sourceId: 'pd-a', startDate: '2026-07-01', endDate: '2026-07-10' }),
      block({
        id: 'a2',
        sourceId: 'pd-a',
        variant: 'actual',
        startDate: '2026-07-04',
        endDate: '2026-07-06',
      }),
      block({ id: 'b1', sourceId: 'pd-b', startDate: '2026-07-02', endDate: '2026-07-08' }),
    ]
    // pd-a shrinks to its actual block, pd-b still runs on granted.
    expect(campWindow(blocks)).toEqual({ startIso: '2026-07-02', endIso: '2026-07-08' })
  })
})

describe('campStatus', () => {
  const dated: CampWindow = { startIso: '2026-07-01', endIso: '2026-07-14' }

  it('is draft with no window at all', () => {
    expect(campStatus(null, '2026-07-05')).toBe('draft')
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
  it('is running on the last day (the end is inclusive)', () => {
    expect(campStatus(dated, '2026-07-14')).toBe('running')
  })
  it('is finished the day after', () => {
    expect(campStatus(dated, '2026-07-15')).toBe('finished')
  })
})
