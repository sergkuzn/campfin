import { describe, expect, it } from 'vitest'
import {
  blockIdsToDelete,
  hasPerDiemSource,
  type IncomeState,
  isMovement,
  isPerDiemBlock,
  isPool,
  orphanPoolIds,
  poolCascade,
  poolPolicyFor,
  sourceBlockIds,
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
const trip: Pool = { id: 'pool-t', campId: 'C', name: 'Trip', role: 'earmarked', createdAt: 3 }

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

const state: IncomeState = {
  pools: [everyday, bike, trip],
  sources: [perDiem, food, kaution],
  blocks: [block('blk-1'), block('blk-2'), block('blk-a', { variant: 'actual' })],
}

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

describe('orphanPoolIds', () => {
  it('drops an earmarked pool nothing feeds', () => {
    expect(orphanPoolIds(state.pools, state.sources)).toEqual(['pool-t'])
  })

  it('drops a deposit pool whose Kaution was deleted', () => {
    const afterDelete = state.sources.filter((s) => s.id !== 'src-dep')
    expect(orphanPoolIds(state.pools, afterDelete)).toEqual(['pool-b', 'pool-t'])
  })

  it('keeps the everyday pool with no sources at all', () => {
    expect(orphanPoolIds([everyday], [])).toEqual([])
  })

  it('keeps a pool that still has a source', () => {
    expect(orphanPoolIds([bike], [kaution])).toEqual([])
  })
})

describe('sourceBlockIds', () => {
  it('lists every block of the source, both variants', () => {
    expect(sourceBlockIds(state.blocks, 'src-pd')).toEqual(['blk-1', 'blk-2', 'blk-a'])
  })

  it('is empty for a source with no blocks', () => {
    expect(sourceBlockIds(state.blocks, 'src-food')).toEqual([])
  })
})

describe('blockIdsToDelete', () => {
  const kept = (id: string | null) => ({ id })
  const granted = ['granted'] as const
  const actual = ['actual'] as const

  it('deletes granted rows the user removed', () => {
    expect(blockIdsToDelete(state.blocks, 'src-pd', granted, [kept('blk-1')])).toEqual(['blk-2'])
  })

  it('leaves actual blocks alone when saving granted ones', () => {
    const doomed = blockIdsToDelete(state.blocks, 'src-pd', granted, [kept('blk-1'), kept('blk-2')])
    expect(doomed).toEqual([]) // 'blk-a' is an actual block and was never on this form
  })

  it('leaves granted blocks alone when saving actual ones', () => {
    expect(blockIdsToDelete(state.blocks, 'src-pd', actual, [kept(null)])).toEqual(['blk-a'])
  })

  it('deletes every actual block when the editor is saved empty', () => {
    // Clearing the actual tab is how a leader says "everybody came after all".
    expect(blockIdsToDelete(state.blocks, 'src-pd', actual, [])).toEqual(['blk-a'])
  })

  it('keeps rows still present by id', () => {
    const doomed = blockIdsToDelete(state.blocks, 'src-pd', granted, [kept('blk-2'), kept(null)])
    expect(doomed).toEqual(['blk-1'])
  })

  it('deletes nothing when no variant was on the form at all', () => {
    // A fixed grant has no blocks; saving one must not touch the per-diem source's rows.
    expect(blockIdsToDelete(state.blocks, 'src-pd', [], [])).toEqual([])
  })
})

describe('poolCascade', () => {
  it('returns the pool’s sources and their blocks', () => {
    expect(poolCascade(state, 'pool-b')).toEqual({ sourceIds: ['src-dep'], blockIds: [] })
  })

  it('takes the per-diem blocks with the pool that funded them', () => {
    // Not reachable from the UI — the everyday pool is undeletable — but a cascade must
    // never leave blocks behind whichever pool it starts from.
    const trippy: IncomeState = {
      ...state,
      pools: [{ ...trip, id: 'pool-e2' }],
      sources: [{ ...perDiem, poolId: 'pool-e2' }],
    }
    expect(poolCascade(trippy, 'pool-e2')).toEqual({
      sourceIds: ['src-pd'],
      blockIds: ['blk-1', 'blk-2', 'blk-a'],
    })
  })

  it('returns nothing for the everyday pool', () => {
    expect(poolCascade(state, 'pool-e')).toBeNull()
  })

  it('returns nothing for an unknown pool', () => {
    expect(poolCascade(state, 'nope')).toBeNull()
  })
})
