import { describe, expect, it } from 'vitest'
import {
  arrangeExpenses,
  blankExpenseDraft,
  draftFromExpense,
  type ExpenseDraft,
  expenseDraftToInput,
  expenseIssues,
  filterExpensesByPools,
  groupExpensesByDay,
  isExpense,
  nextReceiptNumber,
  readReceiptNumber,
  takenReceiptNumbers,
} from './expenses'
import type { Expense } from './types'

/** No receipt number is in use — the case most of these tests are not about. */
const NONE: ReadonlySet<number> = new Set()

/** A complete draft; each test overrides the one field it is about. */
function draft(fields: Partial<ExpenseDraft> = {}): ExpenseDraft {
  return {
    date: '2026-07-14',
    name: 'Bread',
    amount: '12,50',
    poolId: 'pool-1',
    number: '',
    note: '',
    paidBy: 'Anna',
    reimbursed: false,
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
    paidBy: 'Anna',
    createdAt: 1000,
    ...fields,
  }
}

describe('expenseIssues', () => {
  it('is empty for a complete draft', () => {
    expect(expenseIssues(draft(), NONE)).toEqual([])
  })

  it('flags a blank name', () => {
    expect(expenseIssues(draft({ name: '   ' }), NONE)).toContain('name')
  })

  it('flags an amount that is not a euro figure', () => {
    expect(expenseIssues(draft({ amount: 'twelve' }), NONE)).toContain('amount')
  })

  it('flags a zero amount', () => {
    expect(expenseIssues(draft({ amount: '0' }), NONE)).toContain('amount')
  })

  it('flags a negative amount', () => {
    // The parser rejects the minus sign outright, so this must surface as an issue
    // rather than as a negative expense that would inflate a pool's leftover.
    expect(expenseIssues(draft({ amount: '-5,00' }), NONE)).toContain('amount')
  })

  it('flags a missing date', () => {
    expect(expenseIssues(draft({ date: '' }), NONE)).toContain('date')
  })

  it('flags a missing pool', () => {
    expect(expenseIssues(draft({ poolId: '' }), NONE)).toContain('pool')
  })
})

describe('expenseDraftToInput', () => {
  it('returns null for an invalid draft', () => {
    expect(expenseDraftToInput(draft({ amount: '' }), 'c1', null, NONE)).toBeNull()
  })

  it('parses euros as typed into integer cents', () => {
    expect(expenseDraftToInput(draft({ amount: '12,50' }), 'c1', null, NONE)?.amountCents).toBe(
      1250,
    )
    expect(expenseDraftToInput(draft({ amount: '19.99' }), 'c1', null, NONE)?.amountCents).toBe(
      1999,
    )
  })

  it('trims the name', () => {
    expect(expenseDraftToInput(draft({ name: '  Bread  ' }), 'c1', null, NONE)?.name).toBe('Bread')
  })

  it('drops an empty note rather than storing one', () => {
    expect(expenseDraftToInput(draft({ note: '  ' }), 'c1', null, NONE)?.note).toBeUndefined()
    expect(expenseDraftToInput(draft({ note: ' rain ' }), 'c1', null, NONE)?.note).toBe('rain')
  })

  it('carries the row being edited forward', () => {
    const existing = expense()
    expect(expenseDraftToInput(draft(), 'c1', existing, NONE)?.existing).toBe(existing)
  })

  it('round-trips a persisted row through the draft unchanged', () => {
    const row = expense({ note: 'market', number: 7 })
    const input = expenseDraftToInput(draftFromExpense(row), row.campId, row, NONE)
    expect(input).toEqual({
      existing: row,
      campId: row.campId,
      poolId: row.poolId,
      name: row.name,
      amountCents: row.amountCents,
      date: row.date,
      number: 7,
      note: 'market',
      paidBy: 'Anna',
      reimbursed: undefined,
    })
  })
})

describe('blankExpenseDraft', () => {
  it('defaults the date to today, pre-selects the pool and fills in the next number', () => {
    expect(blankExpenseDraft('2026-07-30', 'pool-2', 25)).toEqual({
      paidBy: '',
      reimbursed: false,
      date: '2026-07-30',
      name: '',
      amount: '',
      poolId: 'pool-2',
      number: '25',
      note: '',
    })
  })

  it('fills in 1 in a camp whose receipts are unnumbered', () => {
    expect(blankExpenseDraft('2026-07-30', 'pool-2', 1).number).toBe('1')
  })
})

describe('the payer on a draft', () => {
  it('a new receipt picks nobody — whose money it was is a choice, not a default', () => {
    expect(blankExpenseDraft('2026-07-30', 'pool-2', 1).paidBy).toBe('')
    expect(blankExpenseDraft('2026-07-30', 'pool-2', 1).reimbursed).toBe(false)
  })

  it('stores the name trimmed, and an empty field as no payer at all', () => {
    expect(expenseDraftToInput(draft({ paidBy: '  Ben ' }), 'c1', null, NONE)?.paidBy).toBe('Ben')
    // A blank name is not "no payer" any more — it is an unanswered question, so there is
    // no payload at all.
    expect(expenseDraftToInput(draft({ paidBy: '   ' }), 'c1', null, NONE)).toBeNull()
  })

  it('a brand-new receipt is not repaid', () => {
    const input = expenseDraftToInput(draft({ paidBy: 'Ben' }), 'c1', null, NONE)
    expect(input?.reimbursed).toBeUndefined()
  })

  it('ticking "already paid back" marks the receipt repaid', () => {
    const input = expenseDraftToInput(draft({ paidBy: 'Ben', reimbursed: true }), 'c1', null, NONE)
    expect(input?.reimbursed).toBe(true)
  })

  it('un-ticking it on a settled receipt puts the money back to owed', () => {
    const repaid: Expense = {
      id: 'e1',
      campId: 'c1',
      poolId: 'pool-1',
      name: 'Bread',
      amountCents: 1250,
      date: '2026-07-14',
      paidBy: 'Ben',
      reimbursed: true,
      createdAt: 1,
    }
    const input = expenseDraftToInput(draft({ paidBy: 'Ben' }), 'c1', repaid, NONE)
    expect(input?.reimbursed).toBeUndefined()
  })

  it('blocks the save until somebody is named — the field is compulsory', () => {
    expect(expenseIssues(draft({ paidBy: '' }), NONE)).toContain('paidBy')
    expect(expenseIssues(draft({ paidBy: '   ' }), NONE)).toContain('paidBy')
    expect(expenseIssues(draft({ paidBy: 'Ben' }), NONE)).not.toContain('paidBy')
  })
})

describe('readReceiptNumber', () => {
  it('reads a plain counting number', () => {
    expect(readReceiptNumber('12')).toEqual({ kind: 'value', value: 12 })
    expect(readReceiptNumber(' 3 ')).toEqual({ kind: 'value', value: 3 })
  })

  it('treats an empty field as no number at all', () => {
    expect(readReceiptNumber('')).toEqual({ kind: 'empty' })
    expect(readReceiptNumber('   ')).toEqual({ kind: 'empty' })
  })

  it('refuses anything that is not a positive whole number', () => {
    // "12a" must not be filed as 12: the number's job is to match a paper slip exactly.
    for (const text of ['12a', '1,5', '1.5', '-3', '0', '1e3', '٣']) {
      expect(readReceiptNumber(text).kind).toBe('invalid')
    }
  })
})

describe('takenReceiptNumbers', () => {
  it('collects the numbers in use', () => {
    const rows = [expense({ id: 'a', number: 1 }), expense({ id: 'b', number: 4 }), expense()]
    expect([...takenReceiptNumbers(rows, null)].toSorted()).toEqual([1, 4])
  })

  it('leaves out the row being edited, so re-saving it is not a collision', () => {
    const rows = [expense({ id: 'a', number: 1 }), expense({ id: 'b', number: 4 })]
    expect([...takenReceiptNumbers(rows, 'a')]).toEqual([4])
  })
})

describe('nextReceiptNumber', () => {
  it('starts at 1 in a camp with no numbered receipts', () => {
    expect(nextReceiptNumber([])).toBe(1)
    expect(nextReceiptNumber([expense()])).toBe(1)
  })

  it('is one past the highest in use, even with gaps', () => {
    expect(
      nextReceiptNumber([expense({ id: 'a', number: 1 }), expense({ id: 'b', number: 9 })]),
    ).toBe(10)
  })
})

describe('expenseIssues — receipt numbers', () => {
  it('accepts a draft with no number', () => {
    expect(expenseIssues(draft({ number: '' }), NONE)).toEqual([])
  })

  it('flags a number that is not a counting number', () => {
    expect(expenseIssues(draft({ number: '7b' }), NONE)).toContain('number')
  })

  it('flags a number another receipt already carries', () => {
    expect(expenseIssues(draft({ number: '7' }), new Set([7]))).toContain('numberTaken')
  })

  it('allows a number nobody else has', () => {
    expect(expenseIssues(draft({ number: '8' }), new Set([7]))).toEqual([])
  })
})

describe('filterExpensesByPools', () => {
  const rows = [
    expense({ id: 'a', poolId: 'pool-1' }),
    expense({ id: 'b', poolId: 'pool-2' }),
    expense({ id: 'c', poolId: 'pool-3' }),
  ]

  it('shows everything when nothing is selected', () => {
    expect(filterExpensesByPools(rows, new Set())).toEqual(rows)
  })

  it('keeps only the selected pools', () => {
    const kept = filterExpensesByPools(rows, new Set(['pool-1', 'pool-3']))
    expect(kept.map((e) => e.id)).toEqual(['a', 'c'])
  })

  it('is empty when the selected pool has no receipts', () => {
    expect(filterExpensesByPools(rows, new Set(['pool-9']))).toEqual([])
  })
})

describe('arrangeExpenses', () => {
  const rows = [
    expense({ id: 'a', date: '2026-07-12', number: 2 }),
    expense({ id: 'b', date: '2026-07-15', number: 1 }),
    expense({ id: 'c', date: '2026-07-13' }),
  ]

  it('groups by day, newest first, for date_desc', () => {
    const view = arrangeExpenses(rows, 'date_desc')
    expect(view.mode).toBe('days')
    if (view.mode !== 'days') return
    expect(view.days.map((d) => d.date)).toEqual(['2026-07-15', '2026-07-13', '2026-07-12'])
  })

  it('groups by day, oldest first, for date_asc', () => {
    const view = arrangeExpenses(rows, 'date_asc')
    if (view.mode !== 'days') throw new Error('expected day groups')
    expect(view.days.map((d) => d.date)).toEqual(['2026-07-12', '2026-07-13', '2026-07-15'])
  })

  it('turns the oldest-first rows inside a day round too', () => {
    const sameDay = [
      expense({ id: 'a', createdAt: 100 }),
      expense({ id: 'b', createdAt: 300 }),
      expense({ id: 'c', createdAt: 200 }),
    ]
    const view = arrangeExpenses(sameDay, 'date_asc')
    if (view.mode !== 'days') throw new Error('expected day groups')
    expect(view.days[0]?.expenses.map((e) => e.id)).toEqual(['a', 'c', 'b'])
  })

  it('sorts by number ascending, unnumbered past the highest', () => {
    const view = arrangeExpenses(rows, 'number_asc')
    if (view.mode !== 'flat') throw new Error('expected a flat list')
    expect(view.expenses.map((e) => e.id)).toEqual(['b', 'a', 'c'])
  })

  it('turns the unnumbered rows round with the numbers — they stay beside the big ones', () => {
    const view = arrangeExpenses(rows, 'number_desc')
    if (view.mode !== 'flat') throw new Error('expected a flat list')
    expect(view.expenses.map((e) => e.id)).toEqual(['c', 'a', 'b'])
  })

  it('orders the unnumbered run newest first', () => {
    const unnumbered = [
      expense({ id: 'a', date: '2026-07-12' }),
      expense({ id: 'b', date: '2026-07-15' }),
    ]
    const view = arrangeExpenses(unnumbered, 'number_asc')
    if (view.mode !== 'flat') throw new Error('expected a flat list')
    expect(view.expenses.map((e) => e.id)).toEqual(['b', 'a'])
  })

  it('is empty for no receipts, in every mode', () => {
    for (const sort of ['date_desc', 'date_asc', 'number_asc', 'number_desc'] as const) {
      const view = arrangeExpenses([], sort)
      expect(view.mode === 'days' ? view.days : view.expenses).toEqual([])
    }
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

  it('accepts a numbered row and rejects a broken number', () => {
    expect(isExpense(expense({ number: 3 }))).toBe(true)
    expect(isExpense({ ...expense(), number: 0 })).toBe(false)
    expect(isExpense({ ...expense(), number: 1.5 })).toBe(false)
    expect(isExpense({ ...expense(), number: '3' })).toBe(false)
  })

  it('rejects non-objects', () => {
    expect(isExpense(null)).toBe(false)
    expect(isExpense('e1')).toBe(false)
  })
})
