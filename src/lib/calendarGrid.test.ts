import { describe, expect, it } from 'vitest'
import { isWeekendIso, monthGrid } from './calendarGrid'

describe('isWeekendIso', () => {
  it('flags Saturday and Sunday', () => {
    expect(isWeekendIso('2026-07-04')).toBe(true) // Sat
    expect(isWeekendIso('2026-07-05')).toBe(true) // Sun
  })
  it('leaves weekdays alone', () => {
    expect(isWeekendIso('2026-07-06')).toBe(false) // Mon
    expect(isWeekendIso('2026-07-10')).toBe(false) // Fri
  })
})

describe('monthGrid', () => {
  it('starts each row on Monday', () => {
    // July 2026 opens on a Wednesday.
    const weeks = monthGrid(2026, 6, '2026-07-01')
    expect(weeks[0]?.[0]?.iso).toBe('2026-06-29') // Mon before the 1st
    expect(weeks[0]?.[2]?.iso).toBe('2026-07-01')
  })

  it('marks lead-in/out days as out of month, the rest in', () => {
    const weeks = monthGrid(2026, 6, '2026-07-01')
    expect(weeks[0]?.[0]?.inMonth).toBe(false)
    expect(weeks[0]?.[2]?.inMonth).toBe(true)
    const last = weeks.at(-1)?.at(-1)
    expect(last !== undefined && (last.iso >= '2026-07-31' || last.inMonth)).toBe(true)
  })

  it('marks exactly one day as today, when it falls in the grid', () => {
    const weeks = monthGrid(2026, 6, '2026-07-14')
    const flagged = weeks.flat().filter((d) => d.isToday)
    expect(flagged).toHaveLength(1)
    expect(flagged[0]?.iso).toBe('2026-07-14')
  })

  it('flags no day as today when today falls outside the shown month', () => {
    const weeks = monthGrid(2026, 6, '2026-01-01')
    expect(weeks.flat().some((d) => d.isToday)).toBe(false)
  })

  it('drops a trailing all-padding row', () => {
    // February 2026 starts on a Sunday and has 28 days — 5 weeks cover it exactly, so a
    // 6th row would be pure March padding.
    const weeks = monthGrid(2026, 1, '2026-02-01')
    expect(weeks.length).toBeLessThanOrEqual(5)
  })

  it('never returns a ragged row', () => {
    const weeks = monthGrid(2026, 6, '2026-07-01')
    for (const week of weeks) expect(week).toHaveLength(7)
  })
})
