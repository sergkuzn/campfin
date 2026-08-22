import { describe, expect, it } from 'vitest'
import { summarisePools } from './pools'
import { computeSettlement, type SettlementInput } from './settlement'
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

const block = (over: Partial<PerDiemBlock>): PerDiemBlock => ({
  id: 'b1',
  campId: 'c',
  sourceId: 'pd',
  variant: 'granted',
  numPersons: 4,
  ratePerPersonDayCents: 1000,
  startDate: '2026-07-01',
  endDate: '2026-07-03', // 4 people × 3 inclusive days × 1000 = 12000
  ...over,
})

const granted: PerDiemBlock[] = [block({})]

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

// Two builders, not one with an optional pool: a deposit movement always names its pool
// and a participation fee never does, which is exactly what the union in `types.ts` says.
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
  name: 'Lena',
  amountCents: 3000,
  date: '2026-07-02',
  createdAt: 0,
  ...over,
})

/** The whole camp in one call: the caller summarises pools, so the test does too. */
const settle = (over: Partial<SettlementInput> & { pools?: Pool[] } = {}) => {
  const pools = over.pools ?? [everyday, bike]
  const blocks = over.blocks ?? granted
  const expenses = over.expenses ?? []
  return computeSettlement({
    summaries: over.summaries ?? summarisePools(pools, [pd, food, kaution], blocks, expenses),
    blocks,
    expenses,
    movements: over.movements ?? [],
    moneyHolder: over.moneyHolder,
  })
}

describe('computeSettlement', () => {
  it('builds one row per pool with money left', () => {
    const s = settle({ expenses: [exp({ amountCents: 30_000 })] })

    expect(s.receivedTotalCents).toBe(82_000) // (12000 + 50000) + 20000
    expect(s.spentTotalCents).toBe(30_000)
    expect(s.rows).toEqual([
      { kind: 'pool_unspent', pool: everyday, amountCents: 32_000 },
      { kind: 'deposit_return', pool: bike, amountCents: 20_000 },
    ])
  })

  it('splits the everyday pool into unspent and never-ours-to-spend', () => {
    // Two of the four never came: 2 × 3 × 1000 = 6000 entitled, so 6000 goes back unused.
    const actual = block({ id: 'b2', variant: 'actual', numPersons: 2 })
    const s = settle({ blocks: [...granted, actual], expenses: [exp({ amountCents: 40_000 })] })

    expect(s.rows.slice(0, 2)).toEqual([
      { kind: 'pool_unspent', pool: everyday, amountCents: 16_000 }, // 56000 entitled − 40000
      { kind: 'pool_unusable', pool: everyday, amountCents: 6000 },
    ])
  })

  it('skips zero rows so the sheet only lists real money', () => {
    // Everyday spent to the cent, and the Kaution entirely kept for damage.
    const s = settle({
      expenses: [
        exp({ id: 'e1', amountCents: 62_000 }),
        exp({ id: 'e2', poolId: 'pool-b', amountCents: 20_000 }),
      ],
    })

    expect(s.rows).toEqual([])
    expect(s.toReturnCents).toBe(0)
  })

  it('a deposit’s row is what comes back, not what is still out', () => {
    const s = settle({ movements: [deposit()] }) // handed over, never returned
    const row = s.rows.find((r) => r.kind === 'deposit_return')

    expect(row?.amountCents).toBe(20_000)
    expect(s.warnings).toContainEqual({
      kind: 'deposit_at_vendor',
      pool: bike,
      amountCents: 20_000,
    })
  })

  it('a forfeited Kaution is counted once, not twice', () => {
    // €50 kept for damage, booked as an expense on the deposit pool; the shop returned the
    // other €150. Nothing is left at the vendor and €150 goes back — not €200.
    const s = settle({
      expenses: [exp({ poolId: 'pool-b', amountCents: 5000 })],
      movements: [deposit(), deposit({ id: 'm2', kind: 'deposit_in', amountCents: 15_000 })],
    })

    expect(s.rows).toContainEqual({ kind: 'deposit_return', pool: bike, amountCents: 15_000 })
    expect(s.warnings).toEqual([])
  })

  it('the participation fee is a row of its own and lands in the total', () => {
    const s = settle({
      movements: [fee({ id: 'v1', amountCents: 3000 }), fee({ id: 'v2', amountCents: 2000 })],
    })

    expect(s.rows).toContainEqual({ kind: 'fee', pool: null, amountCents: 5000 })
    expect(s.toReturnCents).toBe(62_000 + 20_000 + 5000)
  })

  it('the rows add up to the total', () => {
    const s = settle({
      expenses: [exp({ amountCents: 1234 })],
      movements: [fee({ amountCents: 777 })],
    })

    expect(s.rows.reduce((sum, row) => sum + row.amountCents, 0)).toBe(s.toReturnCents)
  })

  it('an overspent pool contributes 0 and warns instead', () => {
    const s = settle({ expenses: [exp({ amountCents: 70_000 })] }) // 62000 funded

    expect(s.rows.some((row) => row.pool?.id === everyday.id)).toBe(false)
    expect(s.toReturnCents).toBe(20_000) // the Kaution, untouched by the overspend
    expect(s.warnings).toContainEqual({
      kind: 'pool_overspent',
      pool: everyday,
      amountCents: 8000,
    })
  })

  it('warns when more people came than were granted', () => {
    // Six came where four were funded: entitled is capped at the money that arrived, and
    // the excess is named rather than silently shrinking the return.
    const actual = block({ id: 'b2', variant: 'actual', numPersons: 6 })
    const s = settle({ blocks: [...granted, actual] })

    expect(s.warnings).toContainEqual({ kind: 'over_attended', pool: everyday, amountCents: 6000 })
    expect(s.rows).toContainEqual({ kind: 'pool_unspent', pool: everyday, amountCents: 62_000 })
  })

  it('warns about money the holder still owes a co-leader, one line per person', () => {
    const s = settle({
      expenses: [
        exp({ id: 'e1', amountCents: 800, paidBy: 'Ben' }),
        exp({ id: 'e2', amountCents: 1200, paidBy: 'ben' }), // same person, other spelling
        exp({ id: 'e3', amountCents: 500, paidBy: 'Anna' }), // the holder's own money
        exp({ id: 'e4', amountCents: 900, paidBy: 'Chris', reimbursedAt: 5 }), // settled
      ],
      moneyHolder: 'Anna',
    })

    expect(s.warnings).toContainEqual({
      kind: 'owed_to_payer',
      payerName: 'Ben',
      amountCents: 2000,
    })
    expect(s.warnings.filter((w) => w.kind === 'owed_to_payer')).toHaveLength(1)
  })

  it("does not touch the money that goes back — an IOU between leaders is not the org's", () => {
    const withDebt = settle({
      expenses: [exp({ amountCents: 30_000, paidBy: 'Ben' })],
      moneyHolder: 'Anna',
    })
    const withoutDebt = settle({ expenses: [exp({ amountCents: 30_000 })] })

    expect(withDebt.toReturnCents).toBe(withoutDebt.toReturnCents)
    expect(withDebt.spentTotalCents).toBe(withoutDebt.spentTotalCents)
  })

  it('names no debt while the camp has no money holder', () => {
    const s = settle({ expenses: [exp({ amountCents: 800, paidBy: 'Ben' })] })

    expect(s.warnings.some((w) => w.kind === 'owed_to_payer')).toBe(false)
  })

  it('an empty camp settles to zeros with no rows', () => {
    const s = computeSettlement({ summaries: [], blocks: [], expenses: [], movements: [] })

    expect(s).toEqual({
      receivedTotalCents: 0,
      spentTotalCents: 0,
      toReturnCents: 0,
      rows: [],
      warnings: [],
      pools: [],
    })
  })
})
