import { describe, expect, it } from 'vitest'
import {
  everydayPool,
  poolBar,
  receivedTotalCents,
  sourceAmountCents,
  spendablePools,
  summarisePools,
  toReturnCents,
} from './pools'
import type { AmountSource, Expense, PerDiemBlock, PerDiemSource, Pool } from './types'

const everyday: Pool = {
  id: 'pool-e',
  campId: 'C',
  name: 'Everyday',
  role: 'everyday',
  createdAt: 1,
}
const bike: Pool = { id: 'pool-b', campId: 'C', name: 'Bike', role: 'deposit', createdAt: 2 }

const perDiem: PerDiemSource = {
  id: 'src-pd',
  campId: 'C',
  poolId: 'pool-e',
  kind: 'per_diem',
  name: 'Verpflegungspauschale',
  createdAt: 1,
}
const extraFood: AmountSource = {
  id: 'src-food',
  campId: 'C',
  poolId: 'pool-e',
  kind: 'fixed',
  name: 'Extra food',
  amountCents: 30_000,
  createdAt: 2,
}
const kaution: AmountSource = {
  id: 'src-dep',
  campId: 'C',
  poolId: 'pool-b',
  kind: 'deposit',
  name: 'Bike deposit',
  amountCents: 20_000,
  createdAt: 3,
}

// 4 people × 3 inclusive days × 1000 = 12000
const blocks: PerDiemBlock[] = [
  {
    id: 'b1',
    campId: 'C',
    sourceId: 'src-pd',
    variant: 'granted',
    numPersons: 4,
    ratePerPersonDayCents: 1000,
    startDate: '2026-07-01',
    endDate: '2026-07-03',
  },
  // Belongs to a different source: must not leak into src-pd's amount.
  {
    id: 'b2',
    campId: 'C',
    sourceId: 'other',
    variant: 'granted',
    numPersons: 100,
    ratePerPersonDayCents: 9999,
    startDate: '2026-07-01',
    endDate: '2026-07-03',
  },
]

const exp = (over: Partial<Expense>): Expense => ({
  id: 'e',
  campId: 'C',
  poolId: 'pool-e',
  name: 'receipt',
  amountCents: 0,
  date: '2026-07-02',
  createdAt: 0,
  ...over,
})

describe('sourceAmountCents', () => {
  it('computes a per-diem source from its own blocks only', () => {
    expect(sourceAmountCents(perDiem, blocks)).toBe(12_000)
  })

  it('reads a fixed source amount straight off the row', () => {
    expect(sourceAmountCents(extraFood, blocks)).toBe(30_000)
  })

  it('treats a deposit like any other amount — nothing special happens to it', () => {
    expect(sourceAmountCents(kaution, blocks)).toBe(20_000)
  })

  it('is 0 for a per-diem source with no blocks', () => {
    expect(sourceAmountCents(perDiem, [])).toBe(0)
  })

  it('counts granted blocks only — actual attendance is not money received', () => {
    const withActual: PerDiemBlock[] = [
      ...blocks,
      // Two people dropped out: the same source, half the size, variant 'actual'.
      { ...blocks[0], id: 'b1-actual', variant: 'actual', numPersons: 2 } as PerDiemBlock,
    ]
    expect(sourceAmountCents(perDiem, withActual)).toBe(12_000)
  })
})

describe('everydayPool', () => {
  it('finds the camp’s everyday pool among its pools', () => {
    expect(everydayPool([bike, everyday], 'C')?.id).toBe('pool-e')
  })

  it('is undefined when the camp has none, or when the pool belongs to another camp', () => {
    expect(everydayPool([bike], 'C')).toBeUndefined()
    expect(everydayPool([everyday], 'OTHER')).toBeUndefined()
  })
})

describe('summarisePools', () => {
  it('sums a per-diem and a fixed source funding the same pool', () => {
    const summaries = summarisePools([everyday], [perDiem, extraFood], blocks, [])
    expect(summaries[0]?.fundedCents).toBe(42_000) // 12000 + 30000
    expect(summaries[0]?.sources.map((s) => s.id)).toEqual(['src-pd', 'src-food'])
  })

  it('is all zeros for a pool with no sources', () => {
    const summaries = summarisePools([everyday], [], blocks, [])
    expect(summaries[0]).toMatchObject({
      sources: [],
      fundedCents: 0,
      spentCents: 0,
      remainingCents: 0,
    })
  })

  it('counts only the expenses tagged to that pool', () => {
    const expenses = [
      exp({ id: 'e1', poolId: 'pool-e', amountCents: 5000 }),
      exp({ id: 'e2', poolId: 'pool-b', amountCents: 7000 }),
    ]
    const summaries = summarisePools(
      [everyday, bike],
      [perDiem, extraFood, kaution],
      blocks,
      expenses,
    )
    expect(summaries[0]).toMatchObject({ spentCents: 5000, remainingCents: 37_000 })
    expect(summaries[1]).toMatchObject({ spentCents: 7000, remainingCents: 13_000 })
  })

  it('lets remainingCents go negative when the pool is overspent', () => {
    const summaries = summarisePools([bike], [kaution], blocks, [
      exp({ poolId: 'pool-b', amountCents: 25_000 }),
    ])
    expect(summaries[0]?.remainingCents).toBe(-5000)
  })
})

describe('entitled and unusable money', () => {
  // Two of the four funded people never came: 2 × 3 days × 1000 = 6000 entitled,
  // so 6000 of the 12000 granted has to go back.
  const withActual: PerDiemBlock[] = [
    ...blocks,
    { ...blocks[0], id: 'b1-actual', variant: 'actual', numPersons: 2 } as PerDiemBlock,
  ]

  it('entitles the everyday pool to the actual attendance plus its fixed grants', () => {
    const summaries = summarisePools([everyday], [perDiem, extraFood], withActual, [])
    // The €300 food grant does not shrink with the headcount — only per-diem money does.
    expect(summaries[0]).toMatchObject({
      fundedCents: 42_000,
      entitledCents: 36_000,
      unusableCents: 6000,
    })
  })

  it('leaves a deposit pool’s entitled amount equal to its funded amount', () => {
    const summaries = summarisePools([bike], [kaution], withActual, [])
    expect(summaries[0]).toMatchObject({ entitledCents: 20_000, unusableCents: 0 })
  })

  it('measures remaining against entitled, not granted', () => {
    const summaries = summarisePools([everyday], [perDiem, extraFood], withActual, [
      exp({ amountCents: 10_000 }),
    ])
    expect(summaries[0]?.remainingCents).toBe(26_000) // 36000 − 10000, not 42000 − 10000
  })

  it('adds unusable money to the amount that goes back', () => {
    const summaries = summarisePools([everyday], [perDiem, extraFood], withActual, [
      exp({ amountCents: 10_000 }),
    ])
    // 26000 still unspent + 6000 that was never ours = the whole 32000 leftover.
    expect(toReturnCents(summaries)).toBe(32_000)
  })

  it('returns unusable money even from a pool that is overspent', () => {
    const summaries = summarisePools([everyday], [perDiem], withActual, [
      exp({ amountCents: 9000 }), // 3000 past the 6000 entitlement
    ])
    expect(summaries[0]?.remainingCents).toBe(-3000)
    expect(toReturnCents(summaries)).toBe(6000)
  })

  it('caps entitled at the money that arrived when more people came than were funded', () => {
    const over: PerDiemBlock[] = [
      ...blocks,
      { ...blocks[0], id: 'b1-actual', variant: 'actual', numPersons: 9 } as PerDiemBlock,
    ]
    const summaries = summarisePools([everyday], [perDiem], over, [])
    expect(summaries[0]).toMatchObject({ unusableCents: 0, entitledCents: 12_000 })
  })
})

describe('receivedTotalCents / toReturnCents', () => {
  const summaries = summarisePools([everyday, bike], [perDiem, extraFood, kaution], blocks, [
    exp({ id: 'e1', poolId: 'pool-b', amountCents: 25_000 }), // overspends the bike pool
    exp({ id: 'e2', poolId: 'pool-e', amountCents: 2000 }), // leaves slack in everyday
  ])

  it('sums funded money across pools', () => {
    expect(receivedTotalCents(summaries)).toBe(62_000) // 42000 + 20000
  })

  it('floors per pool: an overspent pool returns 0 without eating another pool’s slack', () => {
    expect(toReturnCents(summaries)).toBe(40_000) // 42000 − 2000, and 0 from bike
  })

  it('is 0 for no pools', () => {
    expect(receivedTotalCents([])).toBe(0)
    expect(toReturnCents([])).toBe(0)
  })
})

describe('poolBar', () => {
  it('is empty for an untouched, unfunded pool', () => {
    expect(poolBar(0, 0)).toEqual({ state: 'empty', fillPercent: 0, overPercent: 0 })
  })

  it('reads a half-spent pool as ok', () => {
    expect(poolBar(20_000, 10_000)).toEqual({ state: 'ok', fillPercent: 50, overPercent: 0 })
  })

  it('turns amber once four fifths are gone', () => {
    expect(poolBar(20_000, 16_000)).toEqual({ state: 'warn', fillPercent: 80, overPercent: 0 })
  })

  it('is a full amber bar when spending exactly matches the funding', () => {
    expect(poolBar(20_000, 20_000)).toEqual({ state: 'warn', fillPercent: 100, overPercent: 0 })
  })

  it('draws an overspend past the end of a full bar', () => {
    expect(poolBar(20_000, 25_000)).toEqual({ state: 'over', fillPercent: 100, overPercent: 25 })
  })

  it('caps the overspend segment so one runaway receipt cannot stretch the row', () => {
    expect(poolBar(20_000, 200_000)).toEqual({ state: 'over', fillPercent: 100, overPercent: 100 })
  })

  it('is over — never a reassuring 0 % — when an unfunded pool is spent from', () => {
    expect(poolBar(0, 500)).toEqual({ state: 'over', fillPercent: 0, overPercent: 100 })
  })

  it('treats a fully funded but untouched pool as ok, not empty', () => {
    expect(poolBar(20_000, 0)).toEqual({ state: 'ok', fillPercent: 0, overPercent: 0 })
  })
})

describe('spendablePools', () => {
  it('leaves out deposit pools, whose money is not the camp’s to spend', () => {
    const summaries = summarisePools([everyday, bike], [perDiem, kaution], blocks, [])
    expect(spendablePools(summaries).map((s) => s.pool.id)).toEqual(['pool-e'])
  })
})
