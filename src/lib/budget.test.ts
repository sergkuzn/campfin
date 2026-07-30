import { describe, expect, it } from 'vitest'
import {
  blockCents,
  blockPersonDays,
  blocksOf,
  formatEuros,
  perDiemBudgetCents,
  perDiemTotals,
  spentTotalCents,
} from './budget'
import type { Expense, PerDiemBlock } from './types'

const block = (over: Partial<PerDiemBlock>): PerDiemBlock => ({
  id: 'b',
  campId: 'c',
  sourceId: 'pd',
  variant: 'granted',
  numPersons: 1,
  ratePerPersonDayCents: 1200,
  startDate: '2026-07-01',
  endDate: '2026-07-01',
  ...over,
})

const expense = (over: Partial<Expense>): Expense => ({
  id: 'e',
  campId: 'c',
  poolId: 'p',
  name: 'receipt',
  amountCents: 0,
  date: '2026-07-02',
  createdAt: 0,
  ...over,
})

describe('blockPersonDays', () => {
  it('multiplies people by inclusive days', () => {
    expect(blockPersonDays(10, '2026-07-01', '2026-07-14')).toBe(140)
  })

  it('counts a single-day block as one day per person', () => {
    expect(blockPersonDays(3, '2026-07-01', '2026-07-01')).toBe(3)
  })
})

describe('blockCents', () => {
  it('multiplies people × inclusive days × rate', () => {
    // 10 people × 14 days × 1200 = 168000
    expect(blockCents(10, 1200, '2026-07-01', '2026-07-14')).toBe(168_000)
  })

  it('counts a single-day block as one day, not zero', () => {
    expect(blockCents(3, 1000, '2026-07-01', '2026-07-01')).toBe(3000)
  })

  it('is 0 for zero people', () => {
    expect(blockCents(0, 1200, '2026-07-01', '2026-07-14')).toBe(0)
  })
})

describe('perDiemBudgetCents', () => {
  // 10 people × 1200 × 14 days = 168000, 2 leaders × 1200 × 16 days = 38400.
  it('sums people × rate × inclusive dayCount across blocks', () => {
    const blocks = [
      block({ numPersons: 10, startDate: '2026-07-01', endDate: '2026-07-14' }),
      block({ numPersons: 2, startDate: '2026-06-30', endDate: '2026-07-15' }),
    ]
    const cents = perDiemBudgetCents(blocks)
    expect(cents).toBe(206_400)
    expect(Number.isInteger(cents)).toBe(true)
  })

  it('is 0 for no blocks (never NaN)', () => {
    expect(perDiemBudgetCents([])).toBe(0)
  })
})

describe('blocksOf', () => {
  it('picks one source and one variant', () => {
    const blocks = [
      block({ id: 'g', variant: 'granted' }),
      block({ id: 'a', variant: 'actual' }),
      block({ id: 'other', sourceId: 'pd2', variant: 'actual' }),
    ]
    expect(blocksOf(blocks, 'pd', 'actual').map((b) => b.id)).toEqual(['a'])
  })
})

describe('perDiemTotals', () => {
  // The reference camp: 10 people × 1000 × 10 days = 100000 granted.
  const granted = block({
    id: 'g',
    numPersons: 10,
    ratePerPersonDayCents: 1000,
    startDate: '2026-07-01',
    endDate: '2026-07-10',
  })

  it('treats granted as actual while no actual block exists', () => {
    const totals = perDiemTotals([granted], 'pd')
    expect(totals).toEqual({
      grantedCents: 100_000,
      entitledCents: 100_000,
      unusableCents: 0,
      overAttendedCents: 0,
      hasActual: false,
    })
  })

  it('subtracts the shortfall when two people drop out', () => {
    // 8 people × 1000 × 10 days = 80000 entitled; 20000 was never ours to spend.
    const actual = block({ ...granted, id: 'a', variant: 'actual', numPersons: 8 })
    const totals = perDiemTotals([granted, actual], 'pd')
    expect(totals.entitledCents).toBe(80_000)
    expect(totals.unusableCents).toBe(20_000)
    expect(totals.hasActual).toBe(true)
  })

  it('reports a shortened stay as unusable money', () => {
    // Everyone left three days early: 10 × 1000 × 7 = 70000.
    const actual = block({ ...granted, id: 'a', variant: 'actual', endDate: '2026-07-07' })
    const totals = perDiemTotals([granted, actual], 'pd')
    expect(totals.entitledCents).toBe(70_000)
    expect(totals.unusableCents).toBe(30_000)
  })

  it('splits a block at a departure date without losing a cent', () => {
    // The departure kink: 8 stay all 10 days, 2 leave after day 4.
    const stayed = block({ ...granted, id: 'a1', variant: 'actual', numPersons: 8 })
    const left = block({
      ...granted,
      id: 'a2',
      variant: 'actual',
      numPersons: 2,
      endDate: '2026-07-04',
    })
    const totals = perDiemTotals([granted, stayed, left], 'pd')
    expect(totals.entitledCents).toBe(80_000 + 8000)
    expect(totals.unusableCents).toBe(12_000)
  })

  it('never returns a negative unusable amount when more people came than were funded', () => {
    const actual = block({ ...granted, id: 'a', variant: 'actual', numPersons: 12 })
    expect(perDiemTotals([granted, actual], 'pd').unusableCents).toBe(0)
  })

  it('reports the overshoot separately when actual exceeds granted', () => {
    const actual = block({ ...granted, id: 'a', variant: 'actual', numPersons: 12 })
    expect(perDiemTotals([granted, actual], 'pd').overAttendedCents).toBe(20_000)
  })

  it('returns zeroes for a source with no blocks at all', () => {
    expect(perDiemTotals([], 'pd')).toEqual({
      grantedCents: 0,
      entitledCents: 0,
      unusableCents: 0,
      overAttendedCents: 0,
      hasActual: false,
    })
  })

  it('ignores blocks belonging to another source', () => {
    const other = block({ id: 'x', sourceId: 'pd2', variant: 'actual', numPersons: 99 })
    expect(perDiemTotals([granted, other], 'pd').entitledCents).toBe(100_000)
  })
})

describe('spentTotalCents', () => {
  it('sums every expense', () => {
    expect(spentTotalCents([expense({ amountCents: 200 }), expense({ amountCents: 800 })])).toBe(
      1000,
    )
  })
  it('is 0 for none', () => {
    expect(spentTotalCents([])).toBe(0)
  })
})

describe('formatEuros', () => {
  it('renders integer cents as a euro amount', () => {
    // Asserted loosely: exact spacing/glyph is ICU-version dependent, digits are not.
    const s = formatEuros(212_500)
    expect(s).toContain('2.125')
    expect(s).toContain('€')
  })

  it('groups and separates by the locale it is given', () => {
    const s = formatEuros(212_500, 'en-GB')
    expect(s).toContain('2,125')
    expect(s).toContain('€') // the currency is EUR whatever the language
  })
})
