import { describe, expect, it } from 'vitest'
import { type BurnInput, burnSeries, computeBurn } from './burn'
import type { AmountSource, Expense, PerDiemBlock, PerDiemSource } from './types'

const perDiem: PerDiemSource = {
  id: 'src-pd',
  campId: 'C',
  poolId: 'pool-e',
  kind: 'per_diem',
  name: 'Group money',
  createdAt: 1,
}

/** Test blocks are terse: only the fields the math reads differ between cases. */
function block(over: Partial<PerDiemBlock> & { id: string }): PerDiemBlock {
  return {
    campId: 'C',
    sourceId: 'src-pd',
    variant: 'granted',
    numPersons: 2,
    ratePerPersonDayCents: 1000,
    startDate: '2026-07-01',
    endDate: '2026-07-03',
    ...over,
  }
}

function expense(over: Partial<Expense> & { id: string }): Expense {
  return {
    campId: 'C',
    poolId: 'pool-e',
    name: 'Bakery',
    amountCents: 1000,
    date: '2026-07-01',
    createdAt: 1,
    ...over,
  }
}

function input(over: Partial<BurnInput> = {}): BurnInput {
  return {
    everydayPoolId: 'pool-e',
    sources: [perDiem],
    blocks: [block({ id: 'b1' })], // 2 ppl × 3 days × €10 = €60
    expenses: [],
    todayIso: '2026-07-02',
    ...over,
  }
}

describe('burnSeries', () => {
  it('emits one ascending point per calendar day', () => {
    const points = burnSeries(input())
    expect(points.map((p) => p.date)).toEqual(['2026-07-01', '2026-07-02', '2026-07-03'])
  })

  it('labels the x axis with the day of the month', () => {
    const points = burnSeries(input())
    expect(points.map((p) => p.dayLabel)).toEqual(['1', '2', '3'])
  })

  it('charges people × rate on every day a block covers', () => {
    const points = burnSeries(input())
    // 2 people × €10 = €20 a day, cumulating to €60.
    expect(points.map((p) => p.allowanceCents)).toEqual([2000, 2000, 2000])
    expect(points.map((p) => p.theoreticalCents)).toEqual([2000, 4000, 6000])
  })

  it('uses actual blocks instead of granted ones when they exist', () => {
    const blocks = [
      block({ id: 'b1' }),
      block({ id: 'b2', variant: 'actual', numPersons: 1 }), // half the people came
    ]
    const points = burnSeries(input({ blocks }))
    expect(points.map((p) => p.allowanceCents)).toEqual([1000, 1000, 1000])
  })

  it('spreads a flat everyday grant across person-days', () => {
    const topUp: AmountSource = {
      id: 'src-food',
      campId: 'C',
      poolId: 'pool-e',
      kind: 'fixed',
      name: 'Extra food',
      amountCents: 3000,
      createdAt: 2,
    }
    // Day 1 has 2 people, days 2–3 have 4: 2 + 4 + 4 = 10 person-days, €30 over them.
    const blocks = [
      block({ id: 'b1' }),
      block({ id: 'b2', numPersons: 2, startDate: '2026-07-02', endDate: '2026-07-03' }),
    ]
    const points = burnSeries(input({ blocks, sources: [perDiem, topUp] }))
    // per-diem: 2000 / 4000 / 4000, flat: 600 / 1200 / 1200
    expect(points.map((p) => p.allowanceCents)).toEqual([2600, 5200, 5200])
  })

  it('spreads a flat grant to the exact cent on the last day', () => {
    const odd: AmountSource = {
      id: 'src-odd',
      campId: 'C',
      poolId: 'pool-e',
      kind: 'fixed',
      name: 'Odd grant',
      amountCents: 100, // €1 over 3 equal days: 33⅓ cents each, must still total 100
      createdAt: 2,
    }
    const points = burnSeries(input({ sources: [perDiem, odd] }))
    const flat = points.map((p) => p.allowanceCents - 2000)
    expect(flat.reduce((sum, cents) => sum + cents, 0)).toBe(100)
    expect(points.at(-1)?.theoreticalCents).toBe(6100)
  })

  it('splits a flat grant evenly when nothing is per-diem funded', () => {
    const topUp: AmountSource = {
      id: 'src-food',
      campId: 'C',
      poolId: 'pool-e',
      kind: 'fixed',
      name: 'Extra food',
      amountCents: 3000,
      createdAt: 2,
    }
    // Zero people means zero person-days — the weight must not divide by zero.
    const blocks = [block({ id: 'b1', numPersons: 0 })]
    const points = burnSeries(input({ blocks, sources: [perDiem, topUp] }))
    expect(points.map((p) => p.allowanceCents)).toEqual([1000, 1000, 1000])
  })

  it('ignores fixed grants that feed another pool', () => {
    const materials: AmountSource = {
      id: 'src-mat',
      campId: 'C',
      poolId: 'pool-m',
      kind: 'fixed',
      name: 'Materials',
      amountCents: 3000,
      createdAt: 2,
    }
    const points = burnSeries(input({ sources: [perDiem, materials] }))
    expect(points.map((p) => p.allowanceCents)).toEqual([2000, 2000, 2000])
  })

  it('ignores expenses from another pool', () => {
    const expenses = [expense({ id: 'e1', poolId: 'pool-m', amountCents: 5000 })]
    const points = burnSeries(input({ expenses }))
    expect(points.map((p) => p.actualCents)).toEqual([0, 0, null])
  })

  it('counts an expense dated before the camp from day one', () => {
    const expenses = [expense({ id: 'e1', date: '2026-06-20', amountCents: 500 })]
    const points = burnSeries(input({ expenses }))
    expect(points.map((p) => p.actualCents)).toEqual([500, 500, null])
  })

  it('stops the actual line after today', () => {
    const expenses = [
      expense({ id: 'e1', date: '2026-07-01', amountCents: 500 }),
      expense({ id: 'e2', date: '2026-07-02', amountCents: 700 }),
      expense({ id: 'e3', date: '2026-07-03', amountCents: 900 }), // dated tomorrow
    ]
    const points = burnSeries(input({ expenses }))
    expect(points.map((p) => p.actualCents)).toEqual([500, 1200, null])
  })

  it('handles a one-day camp', () => {
    const blocks = [block({ id: 'b1', endDate: '2026-07-01' })]
    const points = burnSeries(input({ blocks, todayIso: '2026-07-01' }))
    expect(points).toHaveLength(1)
    expect(points[0]).toMatchObject({ theoreticalCents: 2000, actualCents: 0 })
  })
})

describe('computeBurn', () => {
  it('allowed today is what is left of the cumulative allowance', () => {
    const expenses = [expense({ id: 'e1', date: '2026-07-01', amountCents: 1500 })]
    // Two days accrued (€40), €15 spent.
    expect(computeBurn(input({ expenses })).allowedTodayCents).toBe(2500)
  })

  it('allowed today goes negative once the pool is overspent', () => {
    const expenses = [expense({ id: 'e1', date: '2026-07-01', amountCents: 9000 })]
    expect(computeBurn(input({ expenses })).allowedTodayCents).toBe(-5000)
  })

  it('reads zero before the camp starts', () => {
    const burn = computeBurn(input({ todayIso: '2026-06-25' }))
    expect(burn.allowedTodayCents).toBe(0)
    expect(burn.points).toHaveLength(3) // the curve still renders
  })

  it('has no curve while the camp has no per-diem source', () => {
    const burn = computeBurn(input({ sources: [], blocks: [] }))
    expect(burn.hasCurve).toBe(false)
    expect(burn.points).toEqual([])
    expect(burn.window).toBeNull()
  })

  it('counts only today’s receipts as spent today', () => {
    const expenses = [
      expense({ id: 'e1', date: '2026-07-01', amountCents: 500 }),
      expense({ id: 'e2', date: '2026-07-02', amountCents: 700 }),
      expense({ id: 'e3', date: '2026-07-02', poolId: 'pool-m', amountCents: 900 }),
    ]
    expect(computeBurn(input({ expenses })).spentTodayCents).toBe(700)
  })

  it('takes the median day as the typical day', () => {
    expect(computeBurn(input()).medianDayCents).toBe(2000)
  })

  it('lets a thin arrival day skew the median no further than one place', () => {
    // Two leaders arrive a day early, then twenty people join: the mean day would be
    // €153, which is not what any day of this camp costs.
    const blocks = [
      block({ id: 'b1' }),
      block({ id: 'b2', numPersons: 20, startDate: '2026-07-02', endDate: '2026-07-03' }),
    ]
    expect(computeBurn(input({ blocks })).medianDayCents).toBe(22_000)
  })

  it('averages the two middle days when the camp has an even number of them', () => {
    const blocks = [
      block({ id: 'b1', endDate: '2026-07-04' }), // €20 on all four days
      block({ id: 'b2', numPersons: 3, startDate: '2026-07-03', endDate: '2026-07-04' }),
    ]
    // Days: 2000, 2000, 5000, 5000 → the middle pair averages to €35.
    expect(computeBurn(input({ blocks })).medianDayCents).toBe(3500)
  })

  it('counts today as one of the days left', () => {
    expect(computeBurn(input()).remainingDays).toBe(2)
  })

  it('reports the whole camp as left before it starts, and nothing after it ends', () => {
    expect(computeBurn(input({ todayIso: '2026-06-25' })).remainingDays).toBe(3)
    expect(computeBurn(input({ todayIso: '2026-07-09' })).remainingDays).toBe(0)
  })

  it('has no days left while the camp has no window', () => {
    expect(computeBurn(input({ sources: [], blocks: [] })).remainingDays).toBe(0)
  })
})
