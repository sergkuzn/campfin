import { describe, expect, it } from 'vitest'
import { summarisePools } from './pools'
import { buildReport, type ReportInput } from './report'
import type {
  AmountSource,
  DepositMovement,
  Expense,
  FeeMovement,
  Movement,
  PerDiemBlock,
  PerDiemSource,
  Pool,
} from './types'

const everyday: Pool = {
  id: 'pool-e',
  campId: 'c',
  name: 'Everyday',
  role: 'everyday',
  createdAt: 1,
}
const material: Pool = {
  id: 'pool-m',
  campId: 'c',
  name: 'Material',
  role: 'earmarked',
  createdAt: 3,
}
const bike: Pool = {
  id: 'pool-b',
  campId: 'c',
  name: 'Bike deposit',
  role: 'deposit',
  createdAt: 2,
}

const pd: PerDiemSource = {
  id: 'pd',
  campId: 'c',
  poolId: 'pool-e',
  kind: 'per_diem',
  name: 'Group money',
  createdAt: 0,
}
const food: AmountSource = {
  id: 'food',
  campId: 'c',
  poolId: 'pool-e',
  kind: 'fixed',
  name: 'Group allowance',
  amountCents: 50_000,
  createdAt: 0,
}
const materialMoney: AmountSource = {
  id: 'mat',
  campId: 'c',
  poolId: 'pool-m',
  kind: 'fixed',
  amountCents: 8000,
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
const block = (over: Partial<PerDiemBlock> = {}): PerDiemBlock => ({
  id: 'b1',
  campId: 'c',
  sourceId: 'pd',
  variant: 'granted',
  numPersons: 4,
  ratePerPersonDayCents: 1000,
  startDate: '2026-07-01',
  endDate: '2026-07-03',
  ...over,
})

const granted: PerDiemBlock[] = [block()]

const exp = (over: Partial<Expense> = {}): Expense => ({
  id: 'e',
  campId: 'c',
  poolId: 'pool-e',
  name: 'r',
  amountCents: 0,
  date: '2026-07-02',
  createdAt: 0,
  ...over,
})

const deposit = (over: Partial<DepositMovement> = {}): Movement => ({
  id: 'm',
  campId: 'c',
  kind: 'deposit_out',
  poolId: 'pool-b',
  name: 'Bike shop',
  amountCents: 20_000,
  date: '2026-07-01',
  createdAt: 0,
  ...over,
})

const fee = (over: Partial<FeeMovement> = {}): Movement => ({
  id: 'v',
  campId: 'c',
  kind: 'volunteer_in',
  name: 'Alex',
  amountCents: 3000,
  date: '2026-07-02',
  createdAt: 0,
  ...over,
})

/** The whole camp in one call, summarised the way the screen does it. */
const report = (over: Partial<ReportInput> & { pools?: Pool[] } = {}) => {
  const pools = over.pools ?? [everyday, bike, material]
  const blocks = over.blocks ?? granted
  const expenses = over.expenses ?? []
  return buildReport({
    summaries:
      over.summaries ?? summarisePools(pools, [pd, food, materialMoney, kaution], blocks, expenses),
    blocks,
    expenses,
    movements: over.movements ?? [],
  })
}

describe('buildReport', () => {
  it('lists every income under the cash advance, daily pot first and deposits last', () => {
    const r = report()

    expect(r.advance.map((line) => [line.source.id, line.pool.id, line.amountCents])).toEqual([
      ['pd', 'pool-e', 12_000],
      ['food', 'pool-e', 50_000],
      ['mat', 'pool-m', 8000],
      ['kaution', 'pool-b', 20_000],
    ])
    expect(r.advanceTotalCents).toBe(90_000)
  })

  it('leaves the fee section off entirely when nothing was collected', () => {
    expect(report().fee).toBeNull()
    expect(report().incomeTotalCents).toBe(90_000)
  })

  it('lists the fee one payment at a time, oldest first, with its own total', () => {
    const r = report({
      movements: [
        fee({ id: 'v2', name: 'Bo', amountCents: 2000, date: '2026-07-05' }),
        fee({ id: 'v1', name: 'Alex', amountCents: 3000, date: '2026-07-02' }),
      ],
    })

    expect(r.fee?.payments.map((p) => [p.name, p.amountCents])).toEqual([
      ['Alex', 3000],
      ['Bo', 2000],
    ])
    expect(r.fee?.totalCents).toBe(5000)
    expect(r.incomeTotalCents).toBe(95_000)
  })

  it('gives each pool one expense line, leaving an untouched deposit off', () => {
    const r = report({
      expenses: [
        exp({ id: 'e1', amountCents: 30_000 }),
        exp({ id: 'e2', amountCents: 1000 }),
        exp({ id: 'e3', poolId: 'pool-m', amountCents: 2500 }),
      ],
    })

    expect(r.expenses).toEqual([
      { pool: everyday, spentCents: 31_000 },
      { pool: material, spentCents: 2500 },
    ])
    expect(r.expenseTotalCents).toBe(33_500)
  })

  it('lists a deposit as an expense only for what was kept for damage', () => {
    const r = report({ expenses: [exp({ poolId: 'pool-b', amountCents: 5000 })] })

    expect(r.expenses).toContainEqual({ pool: bike, spentCents: 5000 })
  })

  it('keeps receipts whose pool was deleted in the totals, on a line of their own', () => {
    const r = report({ expenses: [exp({ poolId: 'gone', amountCents: 4200 })] })

    expect(r.expenses.at(-1)).toEqual({ pool: null, spentCents: 4200 })
    expect(r.expenseTotalCents).toBe(4200)
    expect(r.difference).toContainEqual({ kind: 'orphan_spent', pool: null, amountCents: -4200 })
  })

  it('explains the difference line by line, and the lines add up to it', () => {
    const r = report({
      expenses: [
        exp({ amountCents: 30_000 }),
        exp({ id: 'e2', poolId: 'pool-b', amountCents: 5000 }),
      ],
      movements: [deposit(), fee({ amountCents: 3000 })],
    })

    expect(r.difference).toEqual([
      { kind: 'pool_unspent', pool: everyday, amountCents: 32_000 }, // 62000 funded − 30000
      { kind: 'pool_unspent', pool: material, amountCents: 8000 },
      { kind: 'deposit_return', pool: bike, amountCents: 15_000 }, // 20000 − 5000 kept
      { kind: 'fee', pool: null, amountCents: 3000 },
    ])
    expect(sum(r.difference)).toBe(r.differenceCents)
    expect(r.differenceCents).toBe(r.incomeTotalCents - r.expenseTotalCents)
  })

  it('splits a pool into unspent and never-ours-to-spend', () => {
    // Two of the four never came: 2 × 3 × 1000 = 6000 arrived for people who did not.
    const actual = block({ id: 'b2', variant: 'actual', numPersons: 2 })
    const r = report({ blocks: [...granted, actual], expenses: [exp({ amountCents: 40_000 })] })

    expect(r.difference.slice(0, 2)).toEqual([
      { kind: 'pool_unspent', pool: everyday, amountCents: 16_000 }, // 56000 entitled − 40000
      { kind: 'pool_unusable', pool: everyday, amountCents: 6000 },
    ])
    expect(sum(r.difference)).toBe(r.differenceCents)
  })

  it('shows an overspent pool as a negative line rather than flooring it', () => {
    // 62000 funded, 70000 spent. The report is arithmetic: what a leader actually transfers
    // back floors each pool separately, and that is the settlement's job, not this table's.
    const r = report({ expenses: [exp({ amountCents: 70_000 })] })

    expect(r.difference).toContainEqual({
      kind: 'pool_unspent',
      pool: everyday,
      amountCents: -8000,
    })
    expect(sum(r.difference)).toBe(r.differenceCents)
    expect(r.differenceCents).toBe(20_000)
  })

  it('drops zero lines from the difference but keeps the tables', () => {
    // Everyday and material spent to the cent, the whole Kaution kept for damage.
    const r = report({
      expenses: [
        exp({ id: 'e1', amountCents: 62_000 }),
        exp({ id: 'e2', poolId: 'pool-m', amountCents: 8000 }),
        exp({ id: 'e3', poolId: 'pool-b', amountCents: 20_000 }),
      ],
    })

    expect(r.difference).toEqual([])
    expect(r.differenceCents).toBe(0)
    expect(r.expenses).toHaveLength(3) // the Kaution counts here: all of it was kept
  })

  it('an empty camp reports zeros and no lines', () => {
    const r = buildReport({ summaries: [], blocks: [], expenses: [], movements: [] })

    expect(r).toEqual({
      advance: [],
      advanceTotalCents: 0,
      fee: null,
      incomeTotalCents: 0,
      expenses: [],
      expenseTotalCents: 0,
      difference: [],
      differenceCents: 0,
    })
  })
})

function sum(lines: { amountCents: number }[]): number {
  return lines.reduce((total, line) => total + line.amountCents, 0)
}
