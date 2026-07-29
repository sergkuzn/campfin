import { describe, expect, it } from 'vitest'
import { campSlice, emptyIncome, type IncomeState, incomeReducer } from './income'
import type { AmountSource, PerDiemBlock, PerDiemSource, Pool } from './types'

const everyday: Pool = { id: 'pool-e', campId: 'C', name: 'Everyday', createdAt: 1 }
const bike: Pool = { id: 'pool-b', campId: 'C', name: 'Bike', createdAt: 2 }

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
    const pool: Pool = { id: 'pool-new', campId: 'C', name: 'Trip', createdAt: 9 }
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
    const next = incomeReducer(start, { type: 'poolDeleted', poolId: 'pool-e' })
    expect(next.pools.map((p) => p.id)).toEqual(['pool-b'])
    expect(next.sources.map((s) => s.id)).toEqual(['src-dep'])
    expect(next.blocks).toEqual([]) // both blocks belonged to the per-diem source
  })
})

describe('incomeReducer immutability', () => {
  it('never mutates the previous state', () => {
    incomeReducer(start, { type: 'sourceDeleted', sourceId: 'src-pd' })
    incomeReducer(start, { type: 'poolDeleted', poolId: 'pool-e' })
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
