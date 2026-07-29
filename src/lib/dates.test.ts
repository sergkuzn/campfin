import { describe, expect, it } from 'vitest'
import { dayCount, eachDay, isWithin, todayIso, toIsoDate } from './dates'

describe('toIsoDate', () => {
  // `new Date(y, m, d, h, min)` builds a *local* time, so these hold in any timezone —
  // which is the whole point: toISOString() would answer "2026-07-06" east of UTC.
  it('uses local date parts, not UTC ones', () => {
    expect(toIsoDate(new Date(2026, 6, 5, 23, 30))).toBe('2026-07-05')
    expect(toIsoDate(new Date(2026, 6, 5, 0, 30))).toBe('2026-07-05')
  })

  it('pads month and day to two digits', () => {
    expect(toIsoDate(new Date(2026, 0, 1, 12, 0))).toBe('2026-01-01')
  })

  it('todayIso reads the clock through it', () => {
    expect(todayIso()).toBe(toIsoDate(new Date()))
  })
})

describe('dayCount', () => {
  it('is inclusive: a single day counts as 1', () => {
    expect(dayCount('2026-07-01', '2026-07-01')).toBe(1)
  })
  it('01.07-14.07 is 14 days', () => {
    expect(dayCount('2026-07-01', '2026-07-14')).toBe(14)
  })
  it('30.06-14.07 is 15 days', () => {
    expect(dayCount('2026-06-30', '2026-07-14')).toBe(15)
  })
})

describe('isWithin', () => {
  it('strictly inside', () => {
    expect(isWithin('2026-07-10', '2026-07-01', '2026-07-14')).toBe(true)
  })
  it('left endpoint inside', () => {
    expect(isWithin('2026-07-01', '2026-07-01', '2026-07-14')).toBe(true)
  })
  it('right endpoint inside', () => {
    expect(isWithin('2026-07-14', '2026-07-01', '2026-07-14')).toBe(true)
  })
  it('outside', () => {
    expect(isWithin('2026-08-10', '2026-07-01', '2026-07-14')).toBe(false)
  })
  it('the day before the start is outside', () => {
    expect(isWithin('2026-06-30', '2026-07-01', '2026-07-14')).toBe(false)
  })
  it('the day after the end is outside', () => {
    expect(isWithin('2026-07-15', '2026-07-01', '2026-07-14')).toBe(false)
  })
})

describe('eachDay', () => {
  it('lists every day inclusive', () => {
    expect(eachDay('2026-07-01', '2026-07-03')).toEqual(['2026-07-01', '2026-07-02', '2026-07-03'])
  })
  it('a single day yields one entry', () => {
    expect(eachDay('2026-07-01', '2026-07-01')).toEqual(['2026-07-01'])
  })
  it('crosses a month boundary', () => {
    expect(eachDay('2026-06-29', '2026-07-01')).toEqual(['2026-06-29', '2026-06-30', '2026-07-01'])
  })
  it('an inverted range yields nothing', () => {
    expect(eachDay('2026-07-03', '2026-07-01')).toEqual([])
  })
})
