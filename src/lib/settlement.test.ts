import { describe, expect, it } from 'vitest'
import { computeSettlement } from './settlement'
import type { AmountSource, Expense, PerDiemBlock, PerDiemSource, Pool } from './types'

const everyday: Pool = { id: 'pool-e', campId: 'c', name: 'Everyday', createdAt: 1 }
const bike: Pool = { id: 'pool-b', campId: 'c', name: 'Bike deposit', createdAt: 2 }

const pd: PerDiemSource = {
  id: 'pd',
  campId: 'c',
  poolId: 'pool-e',
  kind: 'per_diem',
  name: 'pd',
  createdAt: 0,
}
const food: AmountSource = {
  id: 'food',
  campId: 'c',
  poolId: 'pool-e',
  kind: 'fixed',
  name: 'food',
  amountCents: 50_000,
  createdAt: 0,
}
const kaution: AmountSource = {
  id: 'kaution',
  campId: 'c',
  poolId: 'pool-b',
  kind: 'deposit',
  name: 'Kaution',
  amountCents: 20_000,
  createdAt: 0,
}

// 4 people × 3 inclusive days × 1000 = 12000
const blocks: PerDiemBlock[] = [
  {
    id: 'b1',
    campId: 'c',
    sourceId: 'pd',
    numPersons: 4,
    ratePerPersonDayCents: 1000,
    startDate: '2026-07-01',
    endDate: '2026-07-03',
  },
]

const exp = (over: Partial<Expense>): Expense => ({
  id: 'e',
  campId: 'c',
  poolId: 'pool-e',
  name: 'r',
  amountCents: 0,
  date: '2026-07-02',
  createdAt: 0,
  ...over,
})

describe('computeSettlement', () => {
  it('reconciles a two-pool camp end to end', () => {
    const s = computeSettlement([everyday, bike], [pd, food, kaution], blocks, [
      exp({ id: 'e1', poolId: 'pool-e', amountCents: 30_000 }),
      exp({ id: 'e2', poolId: 'pool-b', amountCents: 5000 }), // damage off the Kaution
    ])

    expect(s.receivedTotalCents).toBe(82_000) // (12000 + 50000) + 20000
    expect(s.spentTotalCents).toBe(35_000)
    expect(s.toReturnCents).toBe(47_000) // 32000 everyday + 15000 bike

    expect(s.pools).toHaveLength(2)
    expect(s.pools[0]).toMatchObject({
      pool: everyday,
      fundedCents: 62_000,
      spentCents: 30_000,
      remainingCents: 32_000,
    })
    expect(s.pools[1]).toMatchObject({
      pool: bike,
      fundedCents: 20_000,
      spentCents: 5000,
      remainingCents: 15_000,
    })
  })

  it('returns everything when nothing was spent', () => {
    const s = computeSettlement([everyday, bike], [pd, food, kaution], blocks, [])
    expect(s.toReturnCents).toBe(s.receivedTotalCents)
    expect(s.spentTotalCents).toBe(0)
  })

  it('an overspent pool returns 0 and does not eat another pool’s leftover', () => {
    const s = computeSettlement([everyday, bike], [pd, food, kaution], blocks, [
      exp({ poolId: 'pool-b', amountCents: 25_000 }),
    ])
    expect(s.pools[1]?.remainingCents).toBe(-5000)
    expect(s.toReturnCents).toBe(62_000) // the everyday pool, untouched
  })

  it('empty camp settles to all zeros', () => {
    const s = computeSettlement([], [], [], [])
    expect(s).toEqual({
      receivedTotalCents: 0,
      spentTotalCents: 0,
      toReturnCents: 0,
      pools: [],
    })
  })
})
