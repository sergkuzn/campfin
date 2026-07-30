import { describe, expect, it } from 'vitest'
import {
  blankExpenseDraft,
  draftFromExpense,
  type ExpenseDraft,
  expenseDraftToInput,
  expenseIssues,
  groupExpensesByDay,
  isExpense,
} from './expenses'
import type { Expense } from './types'

/** A complete draft; each test overrides the one field it is about. */
function draft(fields: Partial<ExpenseDraft> = {}): ExpenseDraft {
  return {
    date: '2026-07-14',
    name: 'Bread',
    amount: '8,00',
    poolId: 'pool-1',
    note: '',
    ...fields,
  }
}

function expense(fields: Partial<Expense> = {}): Expense {
  return {
    id: 'e1',
    campId: 'c1',
    poolId: 'pool-1',
    name: 'Bread',
    amountCents: 1250,
    date: '2026-07-14',
    createdAt: 1000,
    ...fields,
  }
}

describe('expenseIssues', () => {
  it('is empty for a complete draft', () => {
    expect(expenseIssues(draft())).toEqual([])
  })

  it('flags a blank name', () => {
    expect(expenseIssues(draft({ name: '   ' }))).toContain('name')
  })

  it('flags an amount that is not a euro figure', () => {
    expect(expenseIssues(draft({ amount: 'twelve' }))).toContain('amount')
  })

  it('flags a zero amount', () => {
    expect(expenseIssues(draft({ amount: '0' }))).toContain('amount')
  })

  it('flags a negative amount', () => {
    // The parser rejects the minus sign outright, so this must surface as an issue
    // rather than as a negative expense that would inflate a pool's leftover.
    expect(expenseIssues(draft({ amount: '-5,00' }))).toContain('amount')
  })

  it('flags a missing date', () => {
    expect(expenseIssues(draft({ date: '' }))).toContain('date')
  })

  it('flags a missing pool', () => {
    expect(expenseIssues(draft({ poolId: '' }))).toContain('pool')
  })
})

describe('expenseDraftToInput', () => {
  it('returns null for an invalid draft', () => {
    expect(expenseDraftToInput(draft({ amount: '' }), 'c1', null)).toBeNull()
  })

  it('parses euros as typed into integer cents', () => {
    expect(expenseDraftToInput(draft({ amount: '8,00' }), 'c1', null)?.amountCents).toBe(1250)
    expect(expenseDraftToInput(draft({ amount: '19.99' }), 'c1', null)?.amountCents).toBe(1999)
  })

  it('trims the name', () => {
    expect(expenseDraftToInput(draft({ name: '  Bread  ' }), 'c1', null)?.name).toBe('Bread')
  })

  it('drops an empty note rather than storing one', () => {
    expect(expenseDraftToInput(draft({ note: '  ' }), 'c1', null)?.note).toBeUndefined()
    expect(expenseDraftToInput(draft({ note: ' rain ' }), 'c1', null)?.note).toBe('rain')
  })

  it('carries the row being edited forward', () => {
    const existing = expense()
    expect(expenseDraftToInput(draft(), 'c1', existing)?.existing).toBe(existing)
  })

  it('round-trips a persisted row through the draft unchanged', () => {
    const row = expense({ note: 'market' })
    const input = expenseDraftToInput(draftFromExpense(row), row.campId, row)
    expect(input).toEqual({
      existing: row,
      campId: row.campId,
      poolId: row.poolId,
      name: row.name,
      amountCents: row.amountCents,
      date: row.date,
      note: 'market',
    })
  })
})

describe('blankExpenseDraft', () => {
  it('defaults the date to today and pre-selects the pool', () => {
    expect(blankExpenseDraft('2026-07-30', 'pool-2')).toEqual({
      date: '2026-07-30',
      name: '',
      amount: '',
      poolId: 'pool-2',
      note: '',
    })
  })
})

describe('groupExpensesByDay', () => {
  it('is an empty list for no expenses', () => {
    expect(groupExpensesByDay([])).toEqual([])
  })

  it('groups a day’s rows and totals them in cents', () => {
    const days = groupExpensesByDay([
      expense({ id: 'a', amountCents: 1250 }),
      expense({ id: 'b', amountCents: 1099 }),
    ])
    expect(days).toHaveLength(1)
    expect(days[0]?.date).toBe('2026-07-14')
    expect(days[0]?.totalCents).toBe(2349)
  })

  it('puts the newest day first', () => {
    const days = groupExpensesByDay([
      expense({ id: 'a', date: '2026-07-12' }),
      expense({ id: 'b', date: '2026-07-15' }),
      expense({ id: 'c', date: '2026-07-13' }),
    ])
    expect(days.map((d) => d.date)).toEqual(['2026-07-15', '2026-07-13', '2026-07-12'])
  })

  it('puts the newest row first inside a day', () => {
    const days = groupExpensesByDay([
      expense({ id: 'a', createdAt: 100 }),
      expense({ id: 'b', createdAt: 300 }),
      expense({ id: 'c', createdAt: 200 }),
    ])
    expect(days[0]?.expenses.map((e) => e.id)).toEqual(['b', 'c', 'a'])
  })

  it('orders two rows written in the same millisecond identically on both phones', () => {
    const days = groupExpensesByDay([
      expense({ id: 'b', createdAt: 100 }),
      expense({ id: 'a', createdAt: 100 }),
    ])
    expect(days[0]?.expenses.map((e) => e.id)).toEqual(['a', 'b'])
  })
})

describe('isExpense', () => {
  it('accepts a complete row', () => {
    expect(isExpense(expense())).toBe(true)
  })

  it('rejects a row without an amount', () => {
    const { amountCents: _dropped, ...rest } = expense()
    expect(isExpense(rest)).toBe(false)
  })

  it('rejects a row with no pool to spend from', () => {
    expect(isExpense({ ...expense(), poolId: 42 })).toBe(false)
  })

  it('rejects non-objects', () => {
    expect(isExpense(null)).toBe(false)
    expect(isExpense('e1')).toBe(false)
  })
})
