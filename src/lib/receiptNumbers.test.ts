import { describe, expect, it } from 'vitest'
import { nextReceiptNumber, readReceiptNumber, takenReceiptNumbers } from './receiptNumbers'
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
