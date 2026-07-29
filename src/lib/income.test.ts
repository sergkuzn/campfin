import { describe, expect, it } from 'vitest'
import {
  campSlice,
  emptyIncome,
  hasPerDiemSource,
  type IncomeState,
  incomeReducer,
  isMovement,
  isPerDiemBlock,
  isPool,
  poolPolicyFor,
  upgradeBlocks,
  upgradePools,
} from './income'
import type { AmountSource, PerDiemBlock, PerDiemSource, Pool } from './types'

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
  name: 'Per diem',
  createdAt: 1,
}
const food: AmountSource = {
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

const block = (id: string, over: Partial<PerDiemBlock> = {}): PerDiemBlock => ({
  id,
  campId: 'C',
  sourceId: 'src-pd',
  variant: 'granted',
  numPersons: 10,
  ratePerPersonDayCents: 1200,
  startDate: '2026-07-01',
  endDate: '2026-07-14',
  ...over,
})

const load = (state: IncomeState): IncomeState =>
  incomeReducer(emptyIncome, { type: 'loaded', state })

const start = load({
  pools: [everyday, bike],
  sources: [perDiem, food, kaution],
  blocks: [block('blk-1'), block('blk-2')],
})

describe('type guards', () => {
  const validPool = { id: 'p', campId: 'C', name: 'Everyday', role: 'everyday', createdAt: 1 }

  it('isPool rejects a pool without a role', () => {
    expect(isPool(validPool)).toBe(true)
    expect(isPool({ ...validPool, role: undefined })).toBe(false)
    expect(isPool({ ...validPool, role: 'petty-cash' })).toBe(false)
  })

  it('isPerDiemBlock rejects a block without a variant', () => {
    expect(isPerDiemBlock(block('b'))).toBe(true)
    expect(isPerDiemBlock({ ...block('b'), variant: undefined })).toBe(false)
  })

  const movement = {
    id: 'm',
    campId: 'C',
    name: 'Bike shop',
    amountCents: 20_000,
    date: '2026-07-01',
    createdAt: 1,
  }

  it('isMovement requires a poolId on the deposit kinds', () => {
    expect(isMovement({ ...movement, kind: 'deposit_out', poolId: 'pool-b' })).toBe(true)
    expect(isMovement({ ...movement, kind: 'deposit_in', poolId: 'pool-b' })).toBe(true)
    expect(isMovement({ ...movement, kind: 'deposit_out' })).toBe(false)
  })

  it('isMovement accepts volunteer_in without a poolId', () => {
    expect(isMovement({ ...movement, kind: 'volunteer_in' })).toBe(true)
  })

  it('isMovement rejects an unknown kind and a missing amount', () => {
    expect(isMovement({ ...movement, kind: 'refund' })).toBe(false)
    expect(isMovement({ ...movement, kind: 'volunteer_in', amountCents: '200' })).toBe(false)
  })
})

describe('upgradePools / upgradeBlocks', () => {
  const legacy = (id: string) => ({ id, campId: 'C', name: id, createdAt: 1 })

  it('derives everyday from a per-diem source', () => {
    const [pool] = upgradePools([legacy('pool-e')], [{ ...perDiem, poolId: 'pool-e' }])
    expect(pool?.role).toBe('everyday')
  })

  it('derives deposit from a Kaution, and earmarked from anything else', () => {
    const upgraded = upgradePools(
      [legacy('pool-b'), legacy('pool-f')],
      [
        { ...kaution, poolId: 'pool-b' },
        { ...food, poolId: 'pool-f' },
      ],
    )
    expect(upgraded.map((p) => p.role)).toEqual(['deposit', 'earmarked'])
  })

  it('leaves an unfunded pool earmarked', () => {
    expect(upgradePools([legacy('pool-x')], [])[0]?.role).toBe('earmarked')
  })

  it('keeps a role that is already set', () => {
    const already = { ...legacy('pool-e'), role: 'earmarked' as const }
    // The per-diem source would derive 'everyday'; the stored role wins.
    expect(upgradePools([already], [{ ...perDiem, poolId: 'pool-e' }])[0]?.role).toBe('earmarked')
  })

  it('defaults a variant-less block to granted, and keeps an explicit one', () => {
    const { variant, ...variantless } = block('blk-1')
    const upgraded = upgradeBlocks([variantless, { ...block('blk-2'), variant: 'actual' }])
    expect(upgraded.map((b) => b.variant)).toEqual(['granted', 'actual'])
  })
})

describe('poolPolicyFor / hasPerDiemSource', () => {
  it('maps each income kind to its pool policy', () => {
    expect(poolPolicyFor('per_diem')).toBe('everyday')
    expect(poolPolicyFor('fixed')).toBe('choose')
    expect(poolPolicyFor('deposit')).toBe('own')
  })

  it('spots the camp’s one per-diem source', () => {
    expect(hasPerDiemSource([food, kaution])).toBe(false)
    expect(hasPerDiemSource([food, perDiem])).toBe(true)
  })
})

describe('incomeReducer sourceSaved', () => {
  it('appends a source with a new id', () => {
    const fresh: AmountSource = { ...food, id: 'src-new', name: 'Bus grant' }
    const next = incomeReducer(start, { type: 'sourceSaved', source: fresh, blocks: [] })
    expect(next.sources).toHaveLength(4)
    expect(next.sources.at(-1)?.id).toBe('src-new')
  })

  it('replaces a source with an existing id, keeping the list length', () => {
    const edited: AmountSource = { ...food, name: 'Extra food & drinks', amountCents: 45_000 }
    const next = incomeReducer(start, { type: 'sourceSaved', source: edited, blocks: [] })
    expect(next.sources).toHaveLength(3)
    expect(next.sources.find((s) => s.id === 'src-food')).toMatchObject({
      name: 'Extra food & drinks',
      amountCents: 45_000,
    })
  })

  it('replaces the whole block set, so a block removed in the form disappears', () => {
    const next = incomeReducer(start, {
      type: 'sourceSaved',
      source: perDiem,
      blocks: [block('blk-2', { numPersons: 12 })],
    })
    expect(next.blocks.map((b) => b.id)).toEqual(['blk-2'])
    expect(next.blocks[0]?.numPersons).toBe(12)
  })

  it('adds the new pool exactly once when the card created one', () => {
    const pool: Pool = {
      id: 'pool-new',
      campId: 'C',
      name: 'Trip',
      role: 'earmarked',
      createdAt: 9,
    }
    const source: AmountSource = { ...food, id: 'src-trip', poolId: 'pool-new' }
    const next = incomeReducer(start, { type: 'sourceSaved', source, blocks: [], pool })
    expect(next.pools.filter((p) => p.id === 'pool-new')).toHaveLength(1)
  })

  it('drops a pool that an edit moved the last source out of', () => {
    const moved: AmountSource = { ...kaution, poolId: 'pool-e' }
    const next = incomeReducer(start, { type: 'sourceSaved', source: moved, blocks: [] })
    expect(next.pools.map((p) => p.id)).toEqual(['pool-e'])
  })
})

describe('incomeReducer sourceDeleted', () => {
  it('cascades to the source’s blocks', () => {
    const next = incomeReducer(start, { type: 'sourceDeleted', sourceId: 'src-pd' })
    expect(next.sources.map((s) => s.id)).toEqual(['src-food', 'src-dep'])
    expect(next.blocks).toEqual([]) // orphaned blocks are gone
  })

  it('removes the pool when it was the last source in it', () => {
    const next = incomeReducer(start, { type: 'sourceDeleted', sourceId: 'src-dep' })
    expect(next.pools.map((p) => p.id)).toEqual(['pool-e'])
  })

  it('leaves the pool alone while another source still feeds it', () => {
    const next = incomeReducer(start, { type: 'sourceDeleted', sourceId: 'src-food' })
    expect(next.pools.map((p) => p.id)).toEqual(['pool-e', 'pool-b'])
  })
})

describe('incomeReducer poolRenamed / poolDeleted', () => {
  it('renames only the named pool', () => {
    const next = incomeReducer(start, { type: 'poolRenamed', poolId: 'pool-b', name: 'Kaution' })
    expect(next.pools.map((p) => p.name)).toEqual(['Everyday', 'Kaution'])
  })

  it('deletes the pool with its sources and their blocks, touching nothing else', () => {
    const next = incomeReducer(start, { type: 'poolDeleted', poolId: 'pool-b' })
    expect(next.pools.map((p) => p.id)).toEqual(['pool-e'])
    expect(next.sources.map((s) => s.id)).toEqual(['src-pd', 'src-food'])
    expect(next.blocks).toHaveLength(2) // the per-diem blocks are untouched
  })

  it('refuses to delete the everyday pool', () => {
    const next = incomeReducer(start, { type: 'poolDeleted', poolId: 'pool-e' })
    expect(next).toBe(start) // same object: nothing changed, so nothing re-renders
  })

  it('ignores a pool id that does not exist', () => {
    expect(incomeReducer(start, { type: 'poolDeleted', poolId: 'nope' })).toBe(start)
  })
})

describe('the everyday pool survives', () => {
  const onlyPerDiem = load({ pools: [everyday], sources: [perDiem], blocks: [block('blk-1')] })

  it('is kept when its last source is deleted', () => {
    const next = incomeReducer(onlyPerDiem, { type: 'sourceDeleted', sourceId: 'src-pd' })
    expect(next.pools.map((p) => p.id)).toEqual(['pool-e'])
    expect(next.sources).toEqual([])
  })

  it('is kept when a fresh camp saves nothing at all', () => {
    const empty = load({ pools: [everyday], sources: [], blocks: [] })
    const next = incomeReducer(empty, { type: 'sourceSaved', source: food, blocks: [] })
    expect(next.pools.map((p) => p.id)).toEqual(['pool-e'])
  })
})

describe('incomeReducer everydayPoolsEnsured', () => {
  const forCamp = (campId: string, id: string): Pool => ({
    id,
    campId,
    name: 'Everyday',
    role: 'everyday',
    createdAt: 5,
  })

  it('adds an everyday pool for a camp that has none', () => {
    const next = incomeReducer(start, {
      type: 'everydayPoolsEnsured',
      pools: [forCamp('D', 'pool-d')],
    })
    expect(next.pools.map((p) => p.id)).toEqual(['pool-e', 'pool-b', 'pool-d'])
  })

  it('skips a camp that already has one', () => {
    // 'C' already owns pool-e, so this second candidate must be dropped.
    const next = incomeReducer(start, {
      type: 'everydayPoolsEnsured',
      pools: [forCamp('C', 'pool-dup')],
    })
    expect(next).toBe(start)
  })

  it('adds one pool per camp even when the same camp is listed twice', () => {
    const next = incomeReducer(start, {
      type: 'everydayPoolsEnsured',
      pools: [forCamp('D', 'pool-d1'), forCamp('D', 'pool-d2')],
    })
    expect(next.pools.filter((p) => p.campId === 'D').map((p) => p.id)).toEqual(['pool-d1'])
  })

  it('returns the same state for an empty list, so no pointless write fires', () => {
    expect(incomeReducer(start, { type: 'everydayPoolsEnsured', pools: [] })).toBe(start)
  })
})

describe('incomeReducer immutability', () => {
  it('never mutates the previous state', () => {
    incomeReducer(start, { type: 'sourceDeleted', sourceId: 'src-pd' })
    incomeReducer(start, { type: 'poolDeleted', poolId: 'pool-b' })
    incomeReducer(start, { type: 'sourceSaved', source: perDiem, blocks: [] })
    expect(start.pools).toHaveLength(2)
    expect(start.sources).toHaveLength(3)
    expect(start.blocks).toHaveLength(2)
  })
})

describe('campSlice', () => {
  it('keeps only the rows of one camp, across all three namespaces', () => {
    const mixed = load({
      pools: [everyday, { ...bike, id: 'other-pool', campId: 'OTHER' }],
      sources: [perDiem, { ...food, id: 'other-src', campId: 'OTHER' }],
      blocks: [block('blk-1'), block('blk-x', { campId: 'OTHER' })],
    })
    const slice = campSlice(mixed, 'C')
    expect(slice.pools.map((p) => p.id)).toEqual(['pool-e'])
    expect(slice.sources.map((s) => s.id)).toEqual(['src-pd'])
    expect(slice.blocks.map((b) => b.id)).toEqual(['blk-1'])
  })
})
