import { describe, expect, it } from 'vitest'
import {
  type CampsAction,
  campNameExists,
  campStatus,
  campsReducer,
  describeCampStatus,
  isCamp,
  sortCampsByRecent,
} from './camps'
import type { Camp } from './types'

const camp = (over: Partial<Camp> = {}): Camp => ({
  id: 'MOOR-7F3K',
  name: 'Moorwerder',
  createdAt: 1_700_000_000_000,
  ...over,
})

describe('isCamp', () => {
  it('accepts a minimal camp', () => {
    expect(isCamp({ id: 'A', name: 'B', createdAt: 1 })).toBe(true)
  })
  it('accepts a camp with a window', () => {
    expect(
      isCamp({ id: 'A', name: 'B', createdAt: 1, startDate: '2026-07-01', endDate: '2026-07-14' }),
    ).toBe(true)
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
    expect(isCamp({ id: 'A', name: 'B', createdAt: '1' })).toBe(false)
  })
  it('rejects a wrongly-typed optional field', () => {
    expect(isCamp({ id: 'A', name: 'B', createdAt: 1, startDate: 20260701 })).toBe(false)
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

describe('describeCampStatus', () => {
  it('labels every status', () => {
    expect(describeCampStatus('draft')).toBe('No dates yet')
    expect(describeCampStatus('upcoming')).toBe('Upcoming')
    expect(describeCampStatus('running')).toBe('Running')
    expect(describeCampStatus('finished')).toBe('Finished')
  })
})

describe('campsReducer', () => {
  const a = camp({ id: 'A', name: 'Alpha', createdAt: 1 })
  const b = camp({ id: 'B', name: 'Bravo', createdAt: 2 })

  const run = (state: Camp[], action: CampsAction): Camp[] => campsReducer(state, action)

  it('loaded replaces the whole list', () => {
    expect(run([a], { type: 'loaded', camps: [b] })).toEqual([b])
  })
  it('created appends', () => {
    expect(run([a], { type: 'created', camp: b })).toEqual([a, b])
  })
  it('renamed changes only the matching camp', () => {
    const next = run([a, b], { type: 'renamed', campId: 'B', name: 'Bravissimo' })
    expect(next.map((c) => c.name)).toEqual(['Alpha', 'Bravissimo'])
  })
  it('renamed is a no-op for an unknown id', () => {
    expect(run([a], { type: 'renamed', campId: 'ZZZ', name: 'X' })).toEqual([a])
  })
  it('deleted removes the matching camp', () => {
    expect(run([a, b], { type: 'deleted', campId: 'A' })).toEqual([b])
  })
  it('never mutates the previous state', () => {
    const state = [a, b]
    run(state, { type: 'deleted', campId: 'A' })
    run(state, { type: 'renamed', campId: 'A', name: 'Mutated?' })
    expect(state).toEqual([a, b])
    expect(a.name).toBe('Alpha')
  })
})
