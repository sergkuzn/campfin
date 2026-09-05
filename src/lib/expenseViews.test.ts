import { describe, expect, it } from 'vitest'
import { arrangeExpenses, filterExpensesByPools, groupExpensesByDay } from './expenseViews'
import type { Expense } from './types'

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

  it('falls back to the newest row first when a day carries no numbers', () => {
    const days = groupExpensesByDay([
      expense({ id: 'a', createdAt: 100 }),
      expense({ id: 'b', createdAt: 300 }),
      expense({ id: 'c', createdAt: 200 }),
    ])
    expect(days[0]?.expenses.map((e) => e.id)).toEqual(['b', 'c', 'a'])
  })

  it('puts the highest receipt number first inside a day, whatever order they were typed', () => {
    const days = groupExpensesByDay([
      expense({ id: 'a', number: 2, createdAt: 300 }),
      expense({ id: 'b', number: 5, createdAt: 100 }),
      expense({ id: 'c', number: 3, createdAt: 200 }),
    ])
    expect(days[0]?.expenses.map((e) => e.id)).toEqual(['b', 'c', 'a'])
  })

  it('turns a day’s numbers round with the days', () => {
    const days = groupExpensesByDay(
      [
        expense({ id: 'a', number: 2, createdAt: 300 }),
        expense({ id: 'b', number: 5, createdAt: 100 }),
        expense({ id: 'c', number: 3, createdAt: 200 }),
      ],
      'asc',
    )
    expect(days[0]?.expenses.map((e) => e.id)).toEqual(['a', 'c', 'b'])
  })

  it('keeps an unnumbered row beside the big numbers at either end of a day', () => {
    const rows = [
      expense({ id: 'a', number: 2 }),
      expense({ id: 'b' }),
      expense({ id: 'c', number: 5 }),
    ]
    expect(groupExpensesByDay(rows, 'desc')[0]?.expenses.map((e) => e.id)).toEqual(['b', 'c', 'a'])
    expect(groupExpensesByDay(rows, 'asc')[0]?.expenses.map((e) => e.id)).toEqual(['a', 'c', 'b'])
  })

  it('separates two unnumbered rows in a numbered day by entry time', () => {
    const days = groupExpensesByDay([
      expense({ id: 'a', number: 4 }),
      expense({ id: 'b', createdAt: 100 }),
      expense({ id: 'c', createdAt: 300 }),
    ])
    expect(days[0]?.expenses.map((e) => e.id)).toEqual(['c', 'b', 'a'])
  })

  it('orders two rows written in the same millisecond identically on both phones', () => {
    const days = groupExpensesByDay([
      expense({ id: 'b', createdAt: 100 }),
      expense({ id: 'a', createdAt: 100 }),
    ])
    expect(days[0]?.expenses.map((e) => e.id)).toEqual(['a', 'b'])
  })
})
