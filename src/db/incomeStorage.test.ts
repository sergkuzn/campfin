import { beforeEach, describe, expect, it } from 'vitest'
import type { IncomeState } from '../lib/income'
import type { AmountSource, PerDiemSource } from '../lib/types'
import { loadIncome, saveIncome } from './incomeStorage'

const POOLS_V2 = 'campfin.pools.v1'
const SOURCES_V2 = 'campfin.sources.v2'
const BLOCKS_V2 = 'campfin.blocks.v2'
const POOLS_V3 = 'campfin.pools.v3'

const perDiem: PerDiemSource = {
  id: 'src-pd',
  campId: 'C',
  poolId: 'pool-e',
  kind: 'per_diem',
  name: 'Verpflegungspauschale',
  createdAt: 1,
}
const kaution: AmountSource = {
  id: 'src-dep',
  campId: 'C',
  poolId: 'pool-b',
  kind: 'deposit',
  name: 'Bike deposit',
  amountCents: 20_000,
  createdAt: 2,
}

/** A pool and a block as the previous build wrote them: no `role`, no `variant`. */
const v2Pool = (id: string, name: string) => ({ id, campId: 'C', name, createdAt: 1 })
const v2Block = {
  id: 'blk-1',
  campId: 'C',
  sourceId: 'src-pd',
  numPersons: 18,
  ratePerPersonDayCents: 1250,
  startDate: '2026-08-12',
  endDate: '2026-08-19',
}

function writeV2(): void {
  localStorage.setItem(
    POOLS_V2,
    JSON.stringify([v2Pool('pool-e', 'Everyday'), v2Pool('pool-b', 'Bike')]),
  )
  localStorage.setItem(SOURCES_V2, JSON.stringify([perDiem, kaution]))
  localStorage.setItem(BLOCKS_V2, JSON.stringify([v2Block]))
}

describe('loadIncome', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('is empty when nothing was ever stored', () => {
    expect(loadIncome()).toEqual({ pools: [], sources: [], blocks: [] })
  })

  it('round-trips what saveIncome wrote', () => {
    const state: IncomeState = {
      pools: [{ id: 'pool-e', campId: 'C', name: 'Everyday', role: 'everyday', createdAt: 1 }],
      sources: [perDiem],
      blocks: [{ ...v2Block, variant: 'granted' }],
    }
    saveIncome(state)
    expect(loadIncome()).toEqual(state)
  })

  it('migrates v2 rows, giving pools a derived role and blocks the granted variant', () => {
    writeV2()
    const loaded = loadIncome()
    expect(loaded.pools.map((p) => [p.id, p.role])).toEqual([
      ['pool-e', 'everyday'], // fed by the per-diem source
      ['pool-b', 'deposit'], // fed by the Kaution
    ])
    expect(loaded.blocks.map((b) => b.variant)).toEqual(['granted'])
    expect(loaded.sources).toHaveLength(2)
  })

  it('writes the migrated rows through, so the next load reads v3 directly', () => {
    writeV2()
    loadIncome()
    expect(localStorage.getItem(POOLS_V3)).not.toBeNull()

    // The v2 keys survive as the only copy of the pre-migration data.
    localStorage.setItem(POOLS_V2, JSON.stringify([]))
    expect(loadIncome().pools).toHaveLength(2)
  })

  it('drops rows that fail the guard rather than losing the whole namespace', () => {
    localStorage.setItem(
      POOLS_V3,
      JSON.stringify([
        { id: 'ok', campId: 'C', name: 'Everyday', role: 'everyday', createdAt: 1 },
        { id: 'bad', campId: 'C', name: 'No role', createdAt: 1 },
      ]),
    )
    expect(loadIncome().pools.map((p) => p.id)).toEqual(['ok'])
  })
})
