import { describe, expect, it } from 'vitest'
import { receivedTotalCents, sourceAmountCents, summarisePools, toReturnCents } from './pools'
import type { AmountSource, Expense, PerDiemBlock, PerDiemSource, Pool } from './types'

const everyday: Pool = { id: 'pool-e', campId: 'C', name: 'Everyday', createdAt: 1 }
const bike: Pool = { id: 'pool-b', campId: 'C', name: 'Bike', createdAt: 2 }

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
