import { describe, expect, it } from 'vitest'
import {
  filterExpensesByDebt,
  filterExpensesByPayer,
  holderChangeImpact,
  isSamePayer,
  knownPayers,
  owedPayerName,
  owesPayer,
  payerDebts,
  payerKey,
  unreimbursedTotalCents,
} from './payers'
import type { Expense } from './types'

/** A receipt with only the fields these functions read spelled out per test. */
function expense(fields: Partial<Expense> = {}): Expense {
  return {
    id: 'e1',
    campId: 'c1',
    poolId: 'p1',
    name: 'Bakery',
    amountCents: 800,
    date: '2026-07-02',
    createdAt: 1,
    ...fields,
  }
}

describe('payerKey', () => {
  it('ignores case and surrounding space', () => {
    expect(payerKey('  Ben ')).toBe('ben')
  })

  it('collapses a double space inside a name', () => {
    expect(payerKey('Ben  Ohm')).toBe('ben ohm')
  })

  it('reduces a blank name to the empty key', () => {
    expect(payerKey('   ')).toBe('')
  })
})

describe('isSamePayer', () => {
  it('matches two spellings of one person', () => {
    expect(isSamePayer('Ben', 'ben ')).toBe(true)
  })

  it('does not match a missing name to anything, including another missing one', () => {
    expect(isSamePayer(undefined, 'Ben')).toBe(false)
    expect(isSamePayer(undefined, undefined)).toBe(false)
    expect(isSamePayer('', '')).toBe(false)
  })
})

describe('owedPayerName', () => {
  it('names the payer when someone else fronted the money', () => {
    expect(owedPayerName(expense({ paidBy: 'Ben' }), 'Anna')).toBe('Ben')
  })

  it('owes nobody when the holder paid, whatever the spelling', () => {
    expect(owedPayerName(expense({ paidBy: 'anna' }), 'Anna')).toBeNull()
  })

  it('owes nobody once it has been paid back', () => {
    expect(owedPayerName(expense({ paidBy: 'Ben', reimbursedAt: 1234 }), 'Anna')).toBeNull()
  })

  it('owes nobody when the receipt names no payer — every receipt written before the field existed', () => {
    expect(owedPayerName(expense(), 'Anna')).toBeNull()
  })

  it('owes nobody while no holder is named: the whole idea is dormant', () => {
    expect(owedPayerName(expense({ paidBy: 'Ben' }), undefined)).toBeNull()
    expect(owedPayerName(expense({ paidBy: 'Ben' }), '  ')).toBeNull()
  })

  it('trims the name it reports, so the display never carries stray space', () => {
    expect(owedPayerName(expense({ paidBy: ' Ben ' }), 'Anna')).toBe('Ben')
  })
})

describe('knownPayers', () => {
  it('puts the holder first and the rest in alphabetical order', () => {
    const rows = [
      expense({ id: 'a', paidBy: 'Chris' }),
      expense({ id: 'b', paidBy: 'Ben' }),
      expense({ id: 'c', paidBy: 'Anna' }),
    ]
    expect(knownPayers(rows, 'Anna')).toEqual(['Anna', 'Ben', 'Chris'])
  })

  it('lists the holder even when no receipt names them yet', () => {
    expect(knownPayers([], 'Anna')).toEqual(['Anna'])
  })

  it('counts two spellings as one person, keeping the newest', () => {
    const rows = [
      expense({ id: 'a', paidBy: 'ben', createdAt: 1 }),
      expense({ id: 'b', paidBy: 'Ben', createdAt: 2 }),
    ]
    expect(knownPayers(rows, 'Anna')).toEqual(['Anna', 'Ben'])
  })

  it('keeps the holder spelling stored on the camp, not the one on a receipt', () => {
    const rows = [expense({ paidBy: 'anna', createdAt: 9 })]
    expect(knownPayers(rows, 'Anna')).toEqual(['Anna'])
  })

  it('skips receipts with no payer, and works with no holder', () => {
    expect(knownPayers([expense(), expense({ id: 'b', paidBy: 'Ben' })], undefined)).toEqual([
      'Ben',
    ])
  })

  it('is empty for a camp that has neither', () => {
    expect(knownPayers([], undefined)).toEqual([])
  })
})

describe('payerDebts', () => {
  it('totals each person and lists the biggest debt first', () => {
    const rows = [
      expense({ id: 'a', paidBy: 'Ben', amountCents: 500 }),
      expense({ id: 'b', paidBy: 'Chris', amountCents: 2000 }),
      expense({ id: 'c', paidBy: 'Ben', amountCents: 750 }),
    ]
    expect(payerDebts(rows, 'Anna')).toEqual([
      { name: 'Chris', owedCents: 2000, receiptCount: 1 },
      { name: 'Ben', owedCents: 1250, receiptCount: 2 },
    ])
  })

  it('merges spellings and shows the newest one', () => {
    const rows = [
      expense({ id: 'a', paidBy: 'ben', amountCents: 500, createdAt: 1 }),
      expense({ id: 'b', paidBy: 'Ben', amountCents: 500, createdAt: 2 }),
    ]
    expect(payerDebts(rows, 'Anna')).toEqual([{ name: 'Ben', owedCents: 1000, receiptCount: 2 }])
  })

  it('leaves out people who are square', () => {
    const rows = [
      expense({ id: 'a', paidBy: 'Ben', reimbursedAt: 5 }),
      expense({ id: 'b', paidBy: 'Anna' }),
    ]
    expect(payerDebts(rows, 'Anna')).toEqual([])
  })

  it('is empty for a camp with no receipts', () => {
    expect(payerDebts([], 'Anna')).toEqual([])
  })

  it('breaks a tie on equal debts by name, so both phones list them the same way', () => {
    const rows = [
      expense({ id: 'a', paidBy: 'Zoe', amountCents: 100 }),
      expense({ id: 'b', paidBy: 'Ben', amountCents: 100 }),
    ]
    expect(payerDebts(rows, 'Anna').map((debt) => debt.name)).toEqual(['Ben', 'Zoe'])
  })
})

describe('unreimbursedTotalCents', () => {
  it('adds up only what is still owed', () => {
    const rows = [
      expense({ id: 'a', paidBy: 'Ben', amountCents: 500 }),
      expense({ id: 'b', paidBy: 'Ben', amountCents: 400, reimbursedAt: 3 }),
      expense({ id: 'c', paidBy: 'Anna', amountCents: 900 }),
      expense({ id: 'd', amountCents: 1000 }),
    ]
    expect(unreimbursedTotalCents(rows, 'Anna')).toBe(500)
  })

  it('is zero with no holder named', () => {
    expect(unreimbursedTotalCents([expense({ paidBy: 'Ben' })], undefined)).toBe(0)
  })

  it('is zero for an empty camp', () => {
    expect(unreimbursedTotalCents([], 'Anna')).toBe(0)
  })
})

describe('filterExpensesByDebt', () => {
  const rows = [
    expense({ id: 'a', paidBy: 'Ben' }),
    expense({ id: 'b', paidBy: 'Anna' }),
    expense({ id: 'c' }),
  ]

  it('keeps only what is still owed', () => {
    expect(filterExpensesByDebt(rows, true, 'Anna').map((e) => e.id)).toEqual(['a'])
  })

  it('switched off, it is not a filter at all', () => {
    expect(filterExpensesByDebt(rows, false, 'Anna')).toBe(rows)
  })
})

describe('filterExpensesByPayer', () => {
  const rows = [
    expense({ id: 'a', paidBy: 'Ben' }),
    expense({ id: 'b', paidBy: ' ben ' }),
    expense({ id: 'c', paidBy: 'Anna' }),
    expense({ id: 'd' }),
    expense({ id: 'e', paidBy: '   ' }),
  ]

  it('keeps every spelling of the chosen person', () => {
    expect(filterExpensesByPayer(rows, { kind: 'person', name: 'BEN' }).map((e) => e.id)).toEqual([
      'a',
      'b',
    ])
  })

  it('finds the receipts nobody was recorded for — the worklist for an existing camp', () => {
    expect(filterExpensesByPayer(rows, { kind: 'untracked' }).map((e) => e.id)).toEqual(['d', 'e'])
  })

  it('is not a filter at all for everyone, or for a blank name', () => {
    expect(filterExpensesByPayer(rows, { kind: 'all' })).toBe(rows)
    expect(filterExpensesByPayer(rows, { kind: 'person', name: '  ' })).toBe(rows)
  })
})

describe('holderChangeImpact', () => {
  const rows = [
    expense({ id: 'a', paidBy: 'Ben' }), // owed today, Ben's own once he holds the wallet
    expense({ id: 'b', paidBy: 'Ben' }),
    expense({ id: 'c', paidBy: 'Anna' }), // free today, owed once Anna is not the holder
    expense({ id: 'd', paidBy: 'Ben', reimbursedAt: 7 }), // settled, and stays settled
    expense({ id: 'e' }), // no payer, so neither holder can owe for it
  ]

  it('counts both directions of the flip', () => {
    expect(holderChangeImpact(rows, 'Anna', 'Ben')).toEqual({ stopOwing: 2, startOwing: 1 })
  })

  it('clearing the holder ends every debt and starts none', () => {
    expect(holderChangeImpact(rows, 'Anna', null)).toEqual({ stopOwing: 2, startOwing: 0 })
  })

  it('naming the first holder starts debts without ending any', () => {
    expect(holderChangeImpact(rows, undefined, 'Anna')).toEqual({ stopOwing: 0, startOwing: 2 })
  })

  it('respelling the same person changes nothing', () => {
    expect(holderChangeImpact(rows, 'Anna', ' anna ')).toEqual({ stopOwing: 0, startOwing: 0 })
  })
})

describe('owesPayer', () => {
  it('agrees with owedPayerName', () => {
    expect(owesPayer(expense({ paidBy: 'Ben' }), 'Anna')).toBe(true)
    expect(owesPayer(expense({ paidBy: 'Anna' }), 'Anna')).toBe(false)
  })
})
