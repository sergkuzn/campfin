import { describe, expect, it } from 'vitest'
import {
  mapRows,
  toBlock,
  toCamp,
  toExpense,
  toMembership,
  toMovement,
  toPool,
  toSource,
} from './rows'

const campRow = {
  id: 'c1',
  name: 'Moorwerder',
  joinCode: 'MOOR-7F3K',
  createdAt: 1,
  // What a query with `members: {}` actually returns alongside the camp's own fields.
  members: [{ id: 'm1', campId: 'c1', userId: 'u1', role: 'admin', createdAt: 1 }],
}

const blockRow = {
  id: 'b1',
  campId: 'c1',
  sourceId: 's1',
  variant: 'granted',
  numPersons: 10,
  ratePerPersonDayCents: 1200,
  startDate: '2026-07-01',
  endDate: '2026-07-14',
}

describe('toCamp', () => {
  it('maps a camp row and ignores its nested members', () => {
    expect(toCamp(campRow)).toEqual({
      id: 'c1',
      name: 'Moorwerder',
      joinCode: 'MOOR-7F3K',
      createdAt: 1,
    })
  })

  it('carries the camp’s hidden entry cards through', () => {
    expect(toCamp({ ...campRow, hiddenEntries: 'fee,other' })?.hiddenEntries).toBe('fee,other')
  })

  it('drops a camp row without a join code', () => {
    expect(toCamp({ id: 'c1', name: 'Moorwerder', createdAt: 1 })).toBeNull()
  })

  it('drops the dates an older row still carries — the window comes from the blocks now', () => {
    const mapped = toCamp({ ...campRow, startDate: '2026-07-01', endDate: '2026-07-14' })
    expect(mapped).toEqual({ id: 'c1', name: 'Moorwerder', joinCode: 'MOOR-7F3K', createdAt: 1 })
  })
})

describe('optional attributes', () => {
  it('reads a null optional attribute as absent', () => {
    // An unset optional attribute can come back as null; the domain type spells absence
    // `undefined`, and a guard that saw null would have rejected the whole row.
    expect(toBlock({ ...blockRow, label: null })?.label).toBeUndefined()
  })

  it('keeps a label that is set', () => {
    expect(toBlock({ ...blockRow, label: 'Participants' })?.label).toBe('Participants')
  })
})

describe('toSource', () => {
  const base = { id: 's1', campId: 'c1', poolId: 'p1', name: 'Grant', createdAt: 1 }

  it('maps a fixed source with its amount', () => {
    expect(toSource({ ...base, kind: 'fixed', amountCents: 5_000 })).toEqual({
      ...base,
      kind: 'fixed',
      amountCents: 5_000,
    })
  })

  it('drops a fixed source without an amount', () => {
    expect(toSource({ ...base, kind: 'fixed' })).toBeNull()
  })

  it('maps a per-diem source without inventing an amount', () => {
    const mapped = toSource({ ...base, kind: 'per_diem' })
    expect(mapped).toEqual({ ...base, kind: 'per_diem' })
    expect(mapped && 'amountCents' in mapped).toBe(false)
  })

  it('drops an unknown kind', () => {
    expect(toSource({ ...base, kind: 'donation', amountCents: 100 })).toBeNull()
  })
})

describe('toPool / toMembership', () => {
  it('maps a pool row', () => {
    const row = { id: 'p1', campId: 'c1', name: 'Everyday', role: 'everyday', createdAt: 1 }
    expect(toPool(row)).toEqual(row)
  })

  it('drops a pool with an unknown role', () => {
    expect(
      toPool({ id: 'p1', campId: 'c1', name: 'X', role: 'petty-cash', createdAt: 1 }),
    ).toBeNull()
  })

  it('maps a membership row', () => {
    expect(toMembership(campRow.members[0])).toEqual(campRow.members[0])
  })
})

describe('mapRows', () => {
  it('skips unmappable rows instead of throwing', () => {
    const rows = [campRow, { id: 'broken' }, null, { ...campRow, id: 'c2' }]
    expect(mapRows(rows, toCamp).map((c) => c.id)).toEqual(['c1', 'c2'])
  })

  it('treats a query that has not answered yet as empty', () => {
    expect(mapRows(undefined, toCamp)).toEqual([])
  })
})

describe('toExpense', () => {
  const expenseRow = {
    id: 'e1',
    campId: 'c1',
    poolId: 'p1',
    name: 'Bread',
    amountCents: 1250,
    date: '2026-07-14',
    createdAt: 5,
    // What a query with the camp link returns alongside the row's own fields.
    camp: { id: 'c1', name: 'Moorwerder' },
  }

  it('maps an expense row and leaves the linked camp behind', () => {
    expect(toExpense(expenseRow)).toEqual({
      id: 'e1',
      campId: 'c1',
      poolId: 'p1',
      name: 'Bread',
      amountCents: 1250,
      date: '2026-07-14',
      note: undefined,
      enteredBy: undefined,
      createdAt: 5,
    })
  })

  it('drops a row with no amount — a receipt without money is not a receipt', () => {
    const { amountCents: _dropped, ...rest } = expenseRow
    expect(toExpense(rest)).toBeNull()
  })

  it('reads an unset note as absent rather than as null', () => {
    expect(toExpense({ ...expenseRow, note: null })?.note).toBeUndefined()
  })
})

describe('toMovement', () => {
  const movementRow = {
    id: 'mv1',
    campId: 'c1',
    poolId: 'p2',
    kind: 'deposit_out',
    name: 'Bike shop',
    amountCents: 20_000,
    date: '2026-07-02',
    createdAt: 6,
    camp: { id: 'c1', name: 'Moorwerder' },
  }

  it('toMovement rejects a deposit movement with no pool', () => {
    const { poolId: _dropped, ...rest } = movementRow
    expect(toMovement(rest)).toBeNull()
    // The same row as a participation fee is fine — that kind names no pool.
    expect(toMovement({ ...rest, kind: 'volunteer_in' })?.kind).toBe('volunteer_in')
  })

  it('toMovement drops a null note and the linked camp', () => {
    expect(toMovement({ ...movementRow, note: null })).toEqual({
      id: 'mv1',
      campId: 'c1',
      poolId: 'p2',
      kind: 'deposit_out',
      name: 'Bike shop',
      amountCents: 20_000,
      date: '2026-07-02',
      note: undefined,
      createdAt: 6,
    })
  })
})
