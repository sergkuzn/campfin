import { describe, expect, it } from 'vitest'
import {
  blockCents,
  blockPersonDays,
  formatEuros,
  perDiemBudgetCents,
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
