import { describe, expect, it } from 'vitest'
import {
  blankOtherExpenseDraft,
  draftFromOtherExpense,
  isOtherExpense,
  type OtherExpenseDraft,
  otherExpenseDraftToInput,
  otherExpenseIssues,
  otherExpensesTotalCents,
  sortOtherExpensesNewestFirst,
  sortOtherExpensesOldestFirst,
} from './otherExpenses'
import type { OtherExpense } from './types'

const row = (over: Partial<OtherExpense> = {}): OtherExpense => ({
  id: 'o1',
  campId: 'c1',
  name: 'Tent pole',
  amountCents: 2490,
  date: '2026-07-03',
  paidBy: 'Ben',
  createdAt: 10,
  ...over,
})

/** A draft that saves cleanly, so each test can break exactly one thing. */
const valid = (over: Partial<OtherExpenseDraft> = {}): OtherExpenseDraft => ({
  date: '2026-07-03',
  name: 'Tent pole',
  amount: '24,90',
  paidBy: 'Ben',
  note: '',
  ...over,
})

describe('isOtherExpense', () => {
  it('accepts a row with only the required fields', () => {
    expect(isOtherExpense(row())).toBe(true)
  })

  it('rejects a row with no payer', () => {
    const { paidBy: _paidBy, ...withoutPayer } = row()
    // Unlike a receipt's, the payer is required here — nothing predates the question.
    expect(isOtherExpense(withoutPayer)).toBe(false)
  })

  it('rejects the wrong type in an optional field', () => {
    expect(isOtherExpense({ ...row(), reimbursed: 'yes' })).toBe(false)
  })

  it('rejects things that are not rows at all', () => {
    expect(isOtherExpense(null)).toBe(false)
    expect(isOtherExpense('o1')).toBe(false)
  })
})

describe('otherExpenseIssues', () => {
  it('passes a complete draft', () => {
    expect(otherExpenseIssues(valid())).toEqual([])
  })

  it('names an empty field, whitespace included', () => {
    expect(otherExpenseIssues(valid({ name: '   ' }))).toContain('name')
    expect(otherExpenseIssues(valid({ paidBy: ' ' }))).toContain('paidBy')
    expect(otherExpenseIssues(valid({ date: '' }))).toContain('date')
  })

  it('refuses an amount that is not a positive number of euros', () => {
    // Zero buys nothing, a minus sign would reduce what the organisation owes, and a word
    // is not money at all.
    for (const amount of ['0', '0,00', '-5,00', 'later', '']) {
      expect(otherExpenseIssues(valid({ amount }))).toContain('amount')
    }
  })

  it('collects every problem at once rather than stopping at the first', () => {
    expect(otherExpenseIssues(valid({ name: '', amount: '', paidBy: '' })).sort()).toEqual([
      'amount',
      'name',
      'paidBy',
    ])
  })
})

describe('otherExpenseDraftToInput', () => {
  it('converts euros to integer cents', () => {
    expect(otherExpenseDraftToInput(valid({ amount: '24,90' }), 'c1', null)?.amountCents).toBe(2490)
  })

  it('trims what is typed and drops an empty note', () => {
    const input = otherExpenseDraftToInput(valid({ name: '  Tent pole ', note: '  ' }), 'c1', null)

    expect(input?.name).toBe('Tent pole')
    expect(input?.note).toBeUndefined()
  })

  it('refuses an invalid draft rather than writing a half-row', () => {
    expect(otherExpenseDraftToInput(valid({ amount: 'later' }), 'c1', null)).toBeNull()
  })

  it('carries the settled flag from the stored row, not the draft', () => {
    // The tick lives on the list, so editing a row must not silently undo it.
    const existing = row({ reimbursed: true })

    expect(otherExpenseDraftToInput(valid(), 'c1', existing)?.reimbursed).toBe(true)
  })
})

describe('drafts', () => {
  it('starts blank on today with nobody picked', () => {
    const draft = blankOtherExpenseDraft('2026-07-05')

    expect(draft.date).toBe('2026-07-05')
    expect(draft.paidBy).toBe('')
    expect(draft.amount).toBe('')
  })

  it('round-trips a stored row through the editor unchanged', () => {
    const stored = row({ amountCents: 2490, note: 'invoice sent' })
    const input = otherExpenseDraftToInput(draftFromOtherExpense(stored), 'c1', stored)

    expect(input?.amountCents).toBe(2490)
    expect(input?.note).toBe('invoice sent')
    expect(input?.paidBy).toBe('Ben')
  })
})

describe('totals and order', () => {
  it('sums an empty camp to zero', () => {
    expect(otherExpensesTotalCents([])).toBe(0)
  })

  it('sums every row, settled or not — a claim is a claim either way', () => {
    const total = otherExpensesTotalCents([
      row({ id: 'a', amountCents: 2490 }),
      row({ id: 'b', amountCents: 1010, reimbursed: true }),
    ])

    expect(total).toBe(3500)
  })

  it('breaks a same-day tie by creation time, in both directions', () => {
    const rows = [
      row({ id: 'b', date: '2026-07-03', createdAt: 20 }),
      row({ id: 'a', date: '2026-07-03', createdAt: 10 }),
      row({ id: 'c', date: '2026-07-09', createdAt: 5 }),
    ]

    expect(sortOtherExpensesOldestFirst(rows).map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(sortOtherExpensesNewestFirst(rows).map((r) => r.id)).toEqual(['c', 'b', 'a'])
  })

  it('leaves the array it was given alone', () => {
    const rows = [row({ id: 'b', date: '2026-07-09' }), row({ id: 'a', date: '2026-07-03' })]
    sortOtherExpensesOldestFirst(rows)

    expect(rows.map((r) => r.id)).toEqual(['b', 'a'])
  })
})
