import { describe, expect, it } from 'vitest'
import { buildCampExport } from './exportJson'
import { type CampDump, parseCampExport, remapCampExport } from './importJson'
import type { Camp, Expense, IncomeSource, Movement, PerDiemBlock, Pool } from './types'

const camp: Camp = { id: 'c1', name: 'Moorwiese', joinCode: 'MOOR-7F3K', createdAt: 100 }
const pool: Pool = { id: 'p1', campId: 'c1', name: 'Group money', role: 'everyday', createdAt: 1 }
const source: IncomeSource = {
  id: 's1',
  campId: 'c1',
  poolId: 'p1',
  kind: 'per_diem',
  name: 'ijgd',
  createdAt: 1,
}
const block: PerDiemBlock = {
  id: 'b1',
  campId: 'c1',
  sourceId: 's1',
  variant: 'granted',
  numPersons: 4,
  ratePerPersonDayCents: 1000,
  startDate: '2026-07-01',
  endDate: '2026-07-03',
}
const expense: Expense = {
  id: 'e1',
  campId: 'c1',
  poolId: 'p1',
  name: 'Bakery',
  amountCents: 812,
  date: '2026-07-02',
  createdAt: 2,
}
const movement: Movement = {
  id: 'm1',
  campId: 'c1',
  kind: 'volunteer_in',
  name: 'Lena',
  amountCents: 3000,
  date: '2026-07-02',
  createdAt: 3,
}

const dumpText = JSON.stringify(
  buildCampExport(
    camp,
    { pools: [pool], sources: [source], blocks: [block] },
    [expense],
    [movement],
    '2026-07-30T10:00:00.000Z',
  ),
)

/** A counter, so a remap's ids are predictable in assertions. */
const counter = () => {
  let n = 0
  return () => `new-${++n}`
}

const parsed = (text: string): CampDump => {
  const result = parseCampExport(text)
  if (!result.ok) throw new Error(`expected a valid dump, got ${result.issue}`)
  return result.dump
}

describe('parseCampExport', () => {
  it('reads back what buildCampExport wrote', () => {
    const dump = parsed(dumpText)

    expect(dump.camp).toEqual(camp)
    expect(dump.pools).toEqual([pool])
    expect(dump.sources).toEqual([source])
    expect(dump.blocks).toEqual([block])
    expect(dump.expenses).toEqual([expense])
    expect(dump.movements).toEqual([movement])
  })

  it('rejects text that is not JSON', () => {
    expect(parseCampExport('not a file')).toEqual({ ok: false, issue: 'json' })
  })

  it('rejects JSON that is not a campfin dump', () => {
    expect(parseCampExport('{"hello":"world"}')).toEqual({ ok: false, issue: 'format' })
    expect(parseCampExport('[]')).toEqual({ ok: false, issue: 'format' })
  })

  it('rejects a dump whose camp row is unreadable', () => {
    const broken = JSON.stringify({ format: 'campfin.camp', version: 5, camp: { name: 'x' } })
    expect(parseCampExport(broken)).toEqual({ ok: false, issue: 'format' })
  })

  it('rejects a version newer than this build', () => {
    const future = JSON.stringify({ format: 'campfin.camp', version: 8, camp })
    expect(parseCampExport(future)).toEqual({ ok: false, issue: 'version' })
  })

  it('reads a v3 dump that predates expenses and movements', () => {
    const old = JSON.stringify({ format: 'campfin.camp', version: 3, camp, pools: [pool] })
    const dump = parsed(old)

    expect(dump.pools).toEqual([pool])
    expect(dump.expenses).toEqual([])
    expect(dump.movements).toEqual([])
  })

  it('skips a row that fails its guard and keeps the rest', () => {
    const withJunk = JSON.stringify({
      format: 'campfin.camp',
      version: 5,
      camp,
      pools: [pool, { id: 'p2', name: 'no role' }],
    })

    expect(parsed(withJunk).pools).toEqual([pool])
  })
})

describe('remapCampExport', () => {
  const options = { campId: 'camp-new', joinCode: 'NEUE-1A2B', name: 'Moorwiese', newId: counter() }

  it('gives every row a fresh id under the new camp', () => {
    const out = remapCampExport(parsed(dumpText), { ...options, newId: counter() })

    expect(out.camp).toMatchObject({ id: 'camp-new', joinCode: 'NEUE-1A2B', name: 'Moorwiese' })
    expect(out.pools[0]?.id).toBe('new-1')
    expect(out.sources[0]?.id).toBe('new-2')
    // Every row points at the new camp, and the references follow the new ids.
    expect(out.sources[0]?.poolId).toBe('new-1')
    expect(out.blocks[0]?.sourceId).toBe('new-2')
    expect(out.expenses[0]?.poolId).toBe('new-1')
    for (const row of [...out.pools, ...out.sources, ...out.blocks, ...out.expenses]) {
      expect(row.campId).toBe('camp-new')
    }
  })

  it('renames the camp when the caller asks for a free name', () => {
    const out = remapCampExport(parsed(dumpText), { ...options, name: 'Moorwiese (2)' })
    expect(out.camp.name).toBe('Moorwiese (2)')
  })

  it('keeps money, dates and counts untouched', () => {
    const out = remapCampExport(parsed(dumpText), { ...options, newId: counter() })

    expect(out.expenses[0]).toMatchObject({ amountCents: 812, date: '2026-07-02', name: 'Bakery' })
    expect(out.blocks[0]).toMatchObject({ numPersons: 4, ratePerPersonDayCents: 1000 })
    expect(out.movements[0]).toMatchObject({ kind: 'volunteer_in', amountCents: 3000 })
  })

  it('drops rows whose pool or source is gone', () => {
    const orphaned: CampDump = {
      camp,
      pools: [],
      sources: [source], // its pool never made it through the guard
      blocks: [block],
      expenses: [expense],
      movements: [
        {
          id: 'm2',
          campId: 'c1',
          kind: 'deposit_out',
          poolId: 'p1',
          name: 'Shop',
          amountCents: 1,
          date: '2026-07-01',
          createdAt: 1,
        },
      ],
    }
    const out = remapCampExport(orphaned, { ...options, newId: counter() })

    expect(out.sources).toEqual([])
    expect(out.blocks).toEqual([]) // the source went, so its blocks go too
    expect(out.expenses).toEqual([])
    expect(out.movements).toEqual([])
  })

  it('keeps volunteer money, which points at no pool at all', () => {
    const out = remapCampExport(
      { camp, pools: [], sources: [], blocks: [], expenses: [], movements: [movement] },
      { ...options, newId: counter() },
    )

    expect(out.movements).toEqual([{ ...movement, id: 'new-1', campId: 'camp-new' }])
  })
})
