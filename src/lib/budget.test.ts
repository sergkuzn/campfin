import { describe, expect, it } from 'vitest'
import {
  fixedGrantTotalCents,
  formatEuros,
  passthroughTotalCents,
  perDiemBudgetCents,
  reservedRemainingCents,
  spentTotalCents,
} from './budget'
import type { Contribution, Expense, FixedGrantSource, IncomeSource, PerDiemBlock } from './types'

const block = (over: Partial<PerDiemBlock>): PerDiemBlock => ({
  id: 'b',
  campId: 'c',
  sourceId: 'pd',
  numPersons: 1,
  ratePerPersonDayCents: 1200,
  startDate: '2026-07-01',
  endDate: '2026-07-01',
  ...over,
})

const fixed = (over: Partial<FixedGrantSource>): FixedGrantSource => ({
  id: 'f',
  campId: 'c',
  kind: 'fixed',
  use: 'gradual',
  name: 'grant',
  fixedAmountCents: 0,
  createdAt: 0,
  ...over,
})

const expense = (over: Partial<Expense>): Expense => ({
  id: 'e',
  campId: 'c',
  sourceId: 'f',
  name: 'receipt',
  amountCents: 0,
  date: '2026-07-02',
  createdAt: 0,
  ...over,
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

describe('fixedGrantTotalCents', () => {
  const sources: IncomeSource[] = [
    fixed({ id: 'g1', use: 'gradual', fixedAmountCents: 5000 }),
    fixed({ id: 'g2', use: 'gradual', fixedAmountCents: 3000 }),
    fixed({ id: 'r1', use: 'reserved', fixedAmountCents: 10000 }),
    { id: 'pd', campId: 'c', kind: 'per_diem', use: 'gradual', name: 'pd', createdAt: 0 },
    { id: 'pt', campId: 'c', kind: 'passthrough', use: 'passthrough', name: 'pt', createdAt: 0 },
  ]

  it('sums only gradual fixed grants', () => {
    expect(fixedGrantTotalCents(sources, 'gradual')).toBe(8000)
  })
  it('sums only reserved fixed grants', () => {
    expect(fixedGrantTotalCents(sources, 'reserved')).toBe(10000)
  })
  it('is 0 for no sources', () => {
    expect(fixedGrantTotalCents([], 'gradual')).toBe(0)
  })
})

describe('passthroughTotalCents', () => {
  const contribs: Contribution[] = [
    {
      id: 'x',
      campId: 'c',
      sourceId: 'pt',
      name: 'a',
      amountCents: 1000,
      date: '2026-07-01',
      createdAt: 0,
    },
    {
      id: 'y',
      campId: 'c',
      sourceId: 'pt',
      name: 'b',
      amountCents: 2500,
      date: '2026-07-02',
      createdAt: 0,
    },
  ]
  it('sums contributions', () => {
    expect(passthroughTotalCents(contribs)).toBe(3500)
  })
  it('is 0 for none', () => {
    expect(passthroughTotalCents([])).toBe(0)
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

describe('reservedRemainingCents', () => {
  const pot = fixed({ id: 'r1', use: 'reserved', fixedAmountCents: 10000 })
  it('subtracts only expenses tagged to that pot', () => {
    const expenses = [
      expense({ sourceId: 'r1', amountCents: 3000 }),
      expense({ sourceId: 'r1', amountCents: 2000 }),
      expense({ sourceId: 'other', amountCents: 9999 }), // ignored
    ]
    expect(reservedRemainingCents(pot, expenses)).toBe(5000)
  })
  it('is 0 when fully spent', () => {
    expect(reservedRemainingCents(pot, [expense({ sourceId: 'r1', amountCents: 10000 })])).toBe(0)
  })
  it('goes negative when overspent (caller floors it)', () => {
    expect(reservedRemainingCents(pot, [expense({ sourceId: 'r1', amountCents: 12000 })])).toBe(
      -2000,
    )
  })
})

describe('formatEuros', () => {
  it('renders integer cents as a euro amount', () => {
    // Asserted loosely: exact spacing/glyph is ICU-version dependent, digits are not.
    const s = formatEuros(212_500)
    expect(s).toContain('2.125')
    expect(s).toContain('€')
  })
})
