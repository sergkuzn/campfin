import { describe, expect, it } from 'vitest'
import { computeSettlement } from './settlement'
import type { Contribution, Expense, IncomeSource, PerDiemBlock } from './types'

// Most cases pass no per-diem blocks, keeping the arithmetic readable; the
// per-diem source is still present to exercise the "always gradual" branch of
// the spent-split. `folds per-diem blocks into the gradual budget` covers blocks.
const pd: IncomeSource = {
  id: 'pd',
  campId: 'c',
  kind: 'per_diem',
  use: 'gradual',
  name: 'pd',
  createdAt: 0,
}
const g1: IncomeSource = {
  id: 'g1',
  campId: 'c',
  kind: 'fixed',
  use: 'gradual',
  name: 'food',
  fixedAmountCents: 50000,
  createdAt: 0,
}
const r1: IncomeSource = {
  id: 'r1',
  campId: 'c',
  kind: 'fixed',
  use: 'reserved',
  name: 'first-aid',
  fixedAmountCents: 20000,
  createdAt: 0,
}
const p1: IncomeSource = {
  id: 'p1',
  campId: 'c',
  kind: 'passthrough',
  use: 'passthrough',
  name: 'trip',
  createdAt: 0,
}

const exp = (over: Partial<Expense>): Expense => ({
  id: 'e',
  campId: 'c',
  sourceId: 'g1',
  name: 'r',
  amountCents: 0,
  date: '2026-07-02',
  createdAt: 0,
  ...over,
})
const contrib = (amountCents: number): Contribution => ({
  id: `k${amountCents}`,
  campId: 'c',
  sourceId: 'p1',
  name: 'c',
  amountCents,
  date: '2026-07-01',
  createdAt: 0,
})
const noBlocks: PerDiemBlock[] = []

describe('computeSettlement', () => {
  it('reconciles a mixed camp (gradual + reserved + pass-through)', () => {
    const sources = [pd, g1, r1, p1]
    const expenses = [
      exp({ id: 'e1', sourceId: 'g1', amountCents: 30000 }), // gradual
      exp({ id: 'e2', sourceId: 'r1', amountCents: 5000 }), //  reserved
      exp({ id: 'e3', sourceId: 'pd', amountCents: 10000 }), // gradual (per-diem is gradual)
    ]
    const s = computeSettlement(sources, noBlocks, expenses, [contrib(8000)])

    expect(s.receivedTotalCents).toBe(78000) // 0 perdiem + 50000 + 20000 + 8000
    expect(s.spentTotalCents).toBe(45000) // 30000 + 5000 + 10000
    expect(s.breakdown.gradualBudgetCents).toBe(50000)
    expect(s.breakdown.gradualSpentCents).toBe(40000) // e1 + e3, NOT the reserved e2
    expect(s.breakdown.gradualSlackCents).toBe(10000)
    expect(s.breakdown.reservedRemainingCents).toBe(15000)
    expect(s.breakdown.passthroughCents).toBe(8000)
    expect(s.toReturnCents).toBe(33000) // 10000 + 15000 + 8000
  })

  it('everything unspent → toReturn equals received', () => {
    const s = computeSettlement([g1, r1, p1], noBlocks, [], [contrib(8000)])
    expect(s.toReturnCents).toBe(s.receivedTotalCents)
    expect(s.toReturnCents).toBe(78000)
  })

  it('overspent gradual floors the slack at 0 (never returns negative)', () => {
    const s = computeSettlement([g1], noBlocks, [exp({ sourceId: 'g1', amountCents: 60000 })], [])
    expect(s.breakdown.gradualSlackCents).toBe(0)
    expect(s.toReturnCents).toBe(0)
    expect(s.spentTotalCents).toBe(60000)
  })

  it('pass-through-only camp forwards every contribution', () => {
    const s = computeSettlement([p1], noBlocks, [], [contrib(1000), contrib(2000)])
    expect(s.receivedTotalCents).toBe(3000)
    expect(s.toReturnCents).toBe(3000)
    expect(s.spentTotalCents).toBe(0)
  })

  it('folds per-diem blocks into the gradual budget', () => {
    const blocks: PerDiemBlock[] = [
      {
        id: 'b1',
        campId: 'c',
        sourceId: 'pd',
        numPersons: 4,
        ratePerPersonDayCents: 1000,
        startDate: '2026-07-01',
        endDate: '2026-07-03', // 3 inclusive days → 12000
      },
    ]
    const s = computeSettlement([pd, g1], blocks, [exp({ sourceId: 'pd', amountCents: 2000 })], [])

    expect(s.breakdown.gradualBudgetCents).toBe(62000) // 12000 + 50000
    expect(s.receivedTotalCents).toBe(62000)
    expect(s.breakdown.gradualSpentCents).toBe(2000)
    expect(s.toReturnCents).toBe(60000)
  })

  it('empty camp settles to all zeros', () => {
    const s = computeSettlement([], noBlocks, [], [])
    expect(s.receivedTotalCents).toBe(0)
    expect(s.toReturnCents).toBe(0)
  })
})
