import { describe, expect, it } from 'vitest'
import { buildCampExport, exportFileName } from './exportJson'
import type { IncomeState } from './income'
import type { Camp, Expense, PerDiemBlock, Pool } from './types'

const camp: Camp = {
  id: 'c1',
  name: 'Moorwerder Sommercamp',
  joinCode: 'MOOR-7F3K',
  createdAt: 1_700_000_000_000,
}

const pool: Pool = { id: 'p1', campId: 'c1', name: 'Everyday', role: 'everyday', createdAt: 1 }
const block: PerDiemBlock = {
  id: 'b1',
  campId: 'c1',
  sourceId: 's1',
  variant: 'granted',
  numPersons: 10,
  ratePerPersonDayCents: 1200,
  startDate: '2026-07-01',
  endDate: '2026-07-14',
}
const state: IncomeState = {
  pools: [pool],
  sources: [
    { id: 's1', campId: 'c1', poolId: 'p1', kind: 'per_diem', name: 'Per diem', createdAt: 1 },
  ],
  blocks: [block],
}

const expense: Expense = {
  id: 'e1',
  campId: 'c1',
  poolId: 'p1',
  name: 'Bread',
  amountCents: 1250,
  date: '2026-07-14',
  createdAt: 2,
}

describe('buildCampExport', () => {
  it('includes the camp with its pools, sources, blocks and expenses', () => {
    const dump = buildCampExport(camp, state, [expense], '2026-07-29T10:00:00.000Z')
    expect(dump.camp).toEqual(camp)
    expect(dump.pools).toEqual([pool])
    expect(dump.sources.map((s) => s.id)).toEqual(['s1'])
    expect(dump.blocks).toEqual([block])
    expect(dump.expenses).toEqual([expense])
  })

  it('stamps format, version and export date', () => {
    const dump = buildCampExport(camp, state, [], '2026-07-29T10:00:00.000Z')
    expect(dump.format).toBe('campfin.camp')
    expect(dump.version).toBe(4)
    expect(dump.exportedAt).toBe('2026-07-29T10:00:00.000Z')
  })

  it('survives a camp with no income at all', () => {
    const dump = buildCampExport(
      camp,
      { pools: [], sources: [], blocks: [] },
      [],
      '2026-07-29T10:00:00.000Z',
    )
    expect(dump.pools).toEqual([])
    expect(dump.expenses).toEqual([])
    // Round-tripping through JSON is the point of the file, so it must be serialisable.
    expect(JSON.parse(JSON.stringify(dump)).camp.joinCode).toBe('MOOR-7F3K')
  })
})

describe('exportFileName', () => {
  it('slugifies the camp name and dates the file', () => {
    expect(exportFileName(camp, '2026-07-29T10:00:00.000Z')).toBe(
      'campfin-Moorwerder-Sommercamp-2026-07-29.json',
    )
  })

  it('falls back to a usable name when the camp name has no letters', () => {
    expect(exportFileName({ ...camp, name: '!!!' }, '2026-07-29T10:00:00.000Z')).toBe(
      'campfin-camp-2026-07-29.json',
    )
  })
})
