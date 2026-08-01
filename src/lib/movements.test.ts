import { describe, expect, it } from 'vitest'
import {
  custodyOutstandingCents,
  custodyReading,
  type DepositStatus,
  depositStatus,
  depositStatuses,
  draftFromMovement,
  kindsForFocus,
  type MovementDraft,
  movementDraftToInput,
  movementIssues,
  movementsInFocus,
  sortMovements,
  volunteerHeldCents,
} from './movements'
import type { PoolSummary } from './pools'
import type { DepositMovement, Movement, Pool, VolunteerMovement } from './types'

const bikePool: Pool = { id: 'pool-b', campId: 'C', name: 'Bikes', role: 'deposit', createdAt: 2 }
const toolPool: Pool = { id: 'pool-t', campId: 'C', name: 'Tools', role: 'deposit', createdAt: 3 }
const everyday: Pool = {
  id: 'pool-e',
  campId: 'C',
  name: 'Group money',
  role: 'everyday',
  createdAt: 1,
}

/** A deposit pool funded with €200 and, unless said otherwise, nothing spent. */
function summary(pool: Pool, fundedCents: number, spentCents = 0): PoolSummary {
  return {
    pool,
    sources: [],
    fundedCents,
    entitledCents: fundedCents,
    unusableCents: 0,
    spentCents,
    remainingCents: fundedCents - spentCents,
  }
}

function out(amountCents: number, poolId = bikePool.id, id = 'm-out'): DepositMovement {
  return {
    id,
    campId: 'C',
    poolId,
    kind: 'deposit_out',
    name: 'Bike shop',
    amountCents,
    date: '2026-08-01',
    createdAt: 1,
  }
}

function back(amountCents: number, poolId = bikePool.id, id = 'm-in'): DepositMovement {
  return { ...out(amountCents, poolId, id), kind: 'deposit_in', date: '2026-08-14', createdAt: 2 }
}

function volunteer(amountCents: number, id = 'm-v'): VolunteerMovement {
  return {
    id,
    campId: 'C',
    kind: 'volunteer_in',
    name: 'Volunteer cash',
    amountCents,
    date: '2026-08-03',
    createdAt: 3,
  }
}

const validDraft: MovementDraft = {
  kind: 'deposit_out',
  date: '2026-08-01',
  name: 'Bike shop',
  amount: '200,00',
  poolId: bikePool.id,
  note: ' left in cash ',
}

describe('volunteerHeldCents', () => {
  it('volunteerHeldCents sums only volunteer_in rows', () => {
    const movements: Movement[] = [
      volunteer(5_000),
      out(20_000),
      back(20_000),
      volunteer(2_500, 'm-v2'),
    ]
    expect(volunteerHeldCents(movements)).toBe(7_500)
  })

  it('volunteerHeldCents is 0 without movements', () => {
    expect(volunteerHeldCents([])).toBe(0)
  })
})

describe('depositStatus', () => {
  it('depositStatus reads the pool as fully held before anything is handed over', () => {
    const status = depositStatus(summary(bikePool, 20_000), [])
    expect(status.handedOverCents).toBe(0)
    expect(status.atVendorCents).toBe(0)
    expect(status.toReturnCents).toBe(20_000)
  })

  it('depositStatus puts the whole deposit at the vendor once handed over', () => {
    const status = depositStatus(summary(bikePool, 20_000), [out(20_000)])
    expect(status.atVendorCents).toBe(20_000)
    expect(status.toReturnCents).toBe(20_000)
  })

  it('depositStatus nets a partial return against what is still out', () => {
    const status = depositStatus(summary(bikePool, 20_000), [out(20_000), back(15_000)])
    expect(status.returnedCents).toBe(15_000)
    expect(status.atVendorCents).toBe(5_000)
  })

  it('depositStatus reconciles a forfeited deposit booked as an expense', () => {
    // €200 out, €170 back, €30 kept for damage: nothing is outstanding any more.
    const status = depositStatus(summary(bikePool, 20_000, 3_000), [out(20_000), back(17_000)])
    expect(status.forfeitedCents).toBe(3_000)
    expect(status.atVendorCents).toBe(0)
    expect(status.toReturnCents).toBe(17_000)
  })

  it('depositStatus never counts a forfeit twice as a missing return', () => {
    // The other way to book the same loss: no deposit_in for the €30, just the expense.
    const withoutReturn = depositStatus(summary(bikePool, 20_000, 3_000), [out(3_000)])
    expect(withoutReturn.atVendorCents).toBe(0)
    expect(withoutReturn.toReturnCents).toBe(17_000)
  })

  it('depositStatus reports an over-return as a negative atVendor', () => {
    const status = depositStatus(summary(bikePool, 20_000), [out(20_000), back(25_000)])
    expect(status.atVendorCents).toBe(-5_000)
  })

  it('depositStatus ignores movements belonging to another pool', () => {
    const movements: Movement[] = [out(20_000, toolPool.id), volunteer(5_000)]
    expect(depositStatus(summary(bikePool, 20_000), movements).handedOverCents).toBe(0)
  })

  it('depositStatus floors toReturn at 0 when the forfeit exceeds the deposit', () => {
    const status = depositStatus(summary(bikePool, 20_000, 25_000), [out(20_000)])
    expect(status.toReturnCents).toBe(0)
  })
})

describe('depositStatuses', () => {
  it('depositStatuses covers deposit pools only', () => {
    const summaries = [
      summary(everyday, 100_000),
      summary(bikePool, 20_000),
      summary(toolPool, 5_000),
    ]
    const statuses = depositStatuses(summaries, [out(20_000)])
    expect(statuses.map((s) => s.pool.id)).toEqual([bikePool.id, toolPool.id])
  })
})

describe('custodyOutstandingCents', () => {
  it('custodyOutstandingCents sums what is still at vendors, floored per pool', () => {
    const statuses: DepositStatus[] = depositStatuses(
      [summary(bikePool, 20_000), summary(toolPool, 5_000)],
      [out(20_000), back(25_000), out(5_000, toolPool.id, 'm-out-t')],
    )
    // The bike pool is over-returned (−€50); flooring per pool keeps the tool pool's €50
    // outstanding instead of cancelling the two out.
    expect(custodyOutstandingCents(statuses)).toBe(5_000)
  })
})

describe('custodyReading', () => {
  it('custodyReading bundles the deposits and the volunteer money', () => {
    const reading = custodyReading(
      [summary(everyday, 100_000), summary(bikePool, 20_000)],
      [out(20_000), volunteer(5_000), volunteer(2_500, 'm-v2')],
    )
    expect(reading.statuses.map((s) => s.pool.id)).toEqual([bikePool.id])
    expect(reading.volunteerHeldCents).toBe(7_500)
    expect(reading.volunteerCount).toBe(2)
  })
})

describe('movementIssues', () => {
  it('movementIssues demands a pool for a deposit kind', () => {
    expect(movementIssues({ ...validDraft, poolId: '' })).toEqual(['pool'])
  })

  it('movementIssues allows volunteer money without a pool', () => {
    expect(movementIssues({ ...validDraft, kind: 'volunteer_in', poolId: '' })).toEqual([])
  })

  it('movementIssues rejects a zero, negative or unparsable amount', () => {
    expect(movementIssues({ ...validDraft, amount: '0,00' })).toEqual(['amount'])
    expect(movementIssues({ ...validDraft, amount: '-5,00' })).toEqual(['amount'])
    expect(movementIssues({ ...validDraft, amount: 'zwanzig' })).toEqual(['amount'])
  })

  it('movementIssues rejects an empty name and an empty date', () => {
    expect(movementIssues({ ...validDraft, name: '   ', date: '' })).toEqual(['name', 'date'])
  })
})

describe('movementDraftToInput', () => {
  it('movementDraftToInput drops the poolId from volunteer money', () => {
    const input = movementDraftToInput(
      { ...validDraft, kind: 'volunteer_in', poolId: bikePool.id },
      'C',
      null,
    )
    expect(input?.fields).toEqual({
      campId: 'C',
      kind: 'volunteer_in',
      name: 'Bike shop',
      amountCents: 20_000,
      date: '2026-08-01',
      note: 'left in cash',
    })
  })

  it('movementDraftToInput keeps the poolId on a deposit movement', () => {
    const input = movementDraftToInput(validDraft, 'C', null)
    expect(input?.fields).toMatchObject({ kind: 'deposit_out', poolId: bikePool.id })
    expect(input?.existing).toBeNull()
  })

  it('movementDraftToInput returns null while the draft has issues', () => {
    expect(movementDraftToInput({ ...validDraft, amount: '' }, 'C', null)).toBeNull()
  })

  it('draftFromMovement round-trips through movementDraftToInput', () => {
    const movement = out(20_000)
    const input = movementDraftToInput(draftFromMovement(movement), 'C', movement)
    expect(input?.fields).toMatchObject({
      kind: 'deposit_out',
      poolId: bikePool.id,
      amountCents: 20_000,
      date: '2026-08-01',
      name: 'Bike shop',
    })
    expect(input?.existing).toBe(movement)
  })
})

describe('the custody focus split', () => {
  const mixed: Movement[] = [out(20_000), volunteer(5_000), back(20_000), volunteer(2_500, 'm-v2')]

  it('movementsInFocus keeps the deposit rows out of the cash list and back', () => {
    expect(movementsInFocus(mixed, 'deposits').map((m) => m.id)).toEqual(['m-out', 'm-in'])
    expect(movementsInFocus(mixed, 'cash').map((m) => m.id)).toEqual(['m-v', 'm-v2'])
  })

  it('movementsInFocus preserves the order it was given', () => {
    // The screens sort for themselves; filtering must not quietly reorder rows first.
    expect(movementsInFocus(mixed, 'deposits')).toEqual([mixed[0], mixed[2]])
  })

  it('movementsInFocus returns nothing for an empty list', () => {
    expect(movementsInFocus([], 'deposits')).toEqual([])
    expect(movementsInFocus([], 'cash')).toEqual([])
  })

  it('kindsForFocus offers both directions of a deposit, and only those', () => {
    expect(kindsForFocus('deposits', true)).toEqual(['deposit_out', 'deposit_in'])
  })

  it('kindsForFocus offers no deposit kind while the camp has no deposit pool', () => {
    expect(kindsForFocus('deposits', false)).toEqual([])
  })

  it('kindsForFocus offers volunteer money regardless of the deposit pools', () => {
    expect(kindsForFocus('cash', false)).toEqual(['volunteer_in'])
    expect(kindsForFocus('cash', true)).toEqual(['volunteer_in'])
  })
})

describe('sortMovements', () => {
  it('sortMovements puts the newest date first and breaks ties stably', () => {
    const early = out(1_000, bikePool.id, 'a')
    const sameDay = { ...out(2_000, bikePool.id, 'b'), date: '2026-08-14', createdAt: 2 }
    const later = back(3_000)
    const sorted = sortMovements([early, later, sameDay])
    // Same date as `later`, same createdAt — the id decides, identically on both phones.
    expect(sorted.map((m) => m.id)).toEqual(['b', 'm-in', 'a'])
  })
})
