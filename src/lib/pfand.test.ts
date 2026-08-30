import { describe, expect, it } from 'vitest'
import {
  blankPfandDraft,
  draftFromPfandEntry,
  isPfandEntry,
  netPfandCents,
  type PfandDraft,
  pfandBalanceCents,
  pfandBalances,
  pfandDraftToInput,
  pfandIssues,
  pfandLedger,
  pfandOwner,
  receiptGroupCents,
  receiptTotalCents,
} from './pfand'
import type { Expense, PfandEntry } from './types'

function expense(fields: Partial<Expense> = {}): Expense {
  return {
    id: 'e1',
    campId: 'c1',
    poolId: 'pool-1',
    name: 'Drinks',
    amountCents: 1000,
    date: '2026-07-14',
    paidBy: 'Anna',
    createdAt: 1000,
    ...fields,
  }
}

function entry(fields: Partial<PfandEntry> = {}): PfandEntry {
  return {
    id: 'p1',
    campId: 'c1',
    kind: 'refund',
    payer: 'Anna',
    amountCents: 100,
    date: '2026-07-15',
    createdAt: 2000,
    ...fields,
  }
}

function draft(fields: Partial<PfandDraft> = {}): PfandDraft {
  return {
    payer: 'Anna',
    amount: '1,00',
    date: '2026-07-15',
    note: '',
    ...fields,
  }
}

describe('receiptGroupCents', () => {
  it('leaves a receipt without pfand alone, in either mode', () => {
    expect(receiptGroupCents(1250, 0, 0, true)).toBe(1250)
    expect(receiptGroupCents(1250, 0, 0, false)).toBe(1250)
  })

  it('lifts the pfand out of a whole receipt total', () => {
    // 20,00 € on the slip, 1,00 € of it deposit → the pool spent 19,00 €.
    expect(receiptGroupCents(2000, 100, 0, true)).toBe(1900)
  })

  it('puts a refund back onto the goods, because it was the payer’s own money', () => {
    // The slip shows 9,25 € after 0,75 € of deposit came off: the goods were
    // 10,00 €, and the payer got 0,75 € of their own deposit back.
    expect(receiptGroupCents(925, 0, 75, true)).toBe(1000)
  })

  it('handles both directions on one receipt total', () => {
    // Scenario 1, receipt 2: 10,00 € paid, 0,50 € charged, 0,75 € refunded.
    expect(receiptGroupCents(1000, 50, 75, true)).toBe(1025)
  })

  it('leaves the amount untouched when the pfand was entered on top of it', () => {
    expect(receiptGroupCents(1900, 100, 75, false)).toBe(1900)
  })
})

describe('receiptTotalCents', () => {
  it('is the amount plus what was put down, minus what came back', () => {
    const e = expense({ amountCents: 1025, pfandPaidCents: 50, pfandReturnedCents: 75 })
    expect(receiptTotalCents(e)).toBe(1000)
  })

  it('is the amount itself when there is no pfand', () => {
    expect(receiptTotalCents(expense({ amountCents: 1250 }))).toBe(1250)
  })

  it('does not depend on which way the amount was typed', () => {
    const inTotal = expense({ amountCents: 1900, pfandPaidCents: 100, pfandInTotal: true })
    const onTop = expense({ amountCents: 1900, pfandPaidCents: 100 })
    expect(receiptTotalCents(inTotal)).toBe(receiptTotalCents(onTop))
  })
})

describe('pfandLedger', () => {
  it('is empty for receipts that carry no pfand', () => {
    expect(pfandLedger([expense()], [])).toEqual([])
  })

  it('emits one transaction per direction on a receipt', () => {
    const rows = pfandLedger(
      [expense({ pfandPaidCents: 50, pfandReturnedCents: 75, pfandInTotal: true })],
      [],
    )
    expect(rows.map((r) => [r.kind, r.deltaCents])).toEqual([
      ['receipt_paid', 50],
      ['receipt_returned', -75],
    ])
    expect(rows.every((r) => r.payer === 'Anna')).toBe(true)
  })

  it('skips a receipt whose payer is not recorded', () => {
    // Only reachable for rows written before "paid by" was compulsory — and those carry no
    // pfand either. Skipping beats inventing a pocket to charge it to.
    expect(pfandLedger([expense({ paidBy: undefined, pfandPaidCents: 100 })], [])).toEqual([])
    expect(pfandLedger([expense({ paidBy: '  ', pfandPaidCents: 100 })], [])).toEqual([])
  })

  it('signs a hand-entered refund back into the pocket it came from', () => {
    const rows = pfandLedger([], [entry({ id: 'a', kind: 'refund', amountCents: 125 })])
    expect(rows.map((r) => [r.kind, r.deltaCents])).toEqual([['refund', -125]])
  })

  it('books a paid-back receipt’s deposit to the holder, saying where it came from', () => {
    const rows = pfandLedger(
      [expense({ paidBy: 'Ben', reimbursed: true, pfandPaidCents: 100 })],
      [],
      'Anna',
    )
    expect(rows).toEqual([
      expect.objectContaining({ kind: 'receipt_paid', payer: 'Anna', via: 'Ben', deltaCents: 100 }),
    ])
  })

  it('leaves the deposit with the payer while the receipt is still owed', () => {
    const rows = pfandLedger([expense({ paidBy: 'Ben', pfandPaidCents: 100 })], [], 'Anna')
    expect(rows[0]?.payer).toBe('Ben')
    expect(rows[0]?.via).toBeUndefined()
  })

  it('marks nothing "via" when the holder paid the receipt themselves', () => {
    const rows = pfandLedger(
      [expense({ paidBy: ' anna ', reimbursed: true, pfandPaidCents: 100 })],
      [],
      'Anna',
    )
    expect(rows[0]?.via).toBeUndefined()
  })

  it('gives every transaction its own id, even the two from one row', () => {
    const rows = pfandLedger(
      [expense({ pfandPaidCents: 50, pfandReturnedCents: 75 })],
      [entry({ id: 'p1' })],
    )
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length)
  })

  it('sorts newest first, breaking ties on creation order', () => {
    const rows = pfandLedger(
      [],
      [
        entry({ id: 'a', date: '2026-07-10', createdAt: 1 }),
        entry({ id: 'b', date: '2026-07-12', createdAt: 2 }),
        entry({ id: 'c', date: '2026-07-10', createdAt: 3 }),
      ],
    )
    expect(rows.map((r) => r.rowId)).toEqual(['b', 'c', 'a'])
  })
})

describe('pfandBalances', () => {
  /** Scenario 1: one person is charged for four units, returns three and is charged two. */
  it('tracks one payer across two receipts', () => {
    const ledger = pfandLedger(
      [
        expense({ id: 'e1', pfandPaidCents: 100, pfandInTotal: true }),
        expense({ id: 'e2', pfandPaidCents: 50, pfandReturnedCents: 75, pfandInTotal: true }),
      ],
      [],
    )
    expect(pfandBalances(ledger)).toEqual([{ name: 'Anna', outstandingCents: 75, txnCount: 3 }])
  })

  /** Scenario 2: a co-leader fronts the deposit, the money holder pays them back. */
  it('moves a balance to the holder when the receipt is ticked off', () => {
    const owed = expense({ paidBy: 'Anna', pfandPaidCents: 100 })
    const before = pfandBalances(pfandLedger([owed], [], 'Ben'))
    expect(pfandBalanceCents(before, 'Anna')).toBe(100)

    const after = pfandBalances(pfandLedger([{ ...owed, reimbursed: true }], [], 'Ben'))
    expect(pfandBalanceCents(after, 'Anna')).toBe(0)
    expect(pfandBalanceCents(after, 'Ben')).toBe(100)
  })

  /** Scenario 3: the two mixed — Ben takes Anna's over, then refunds part of it. */
  it('handles a partial refund after a receipt has been paid back', () => {
    const ledger = pfandLedger(
      [
        expense({ id: 'e1', paidBy: 'Anna', reimbursed: true, pfandPaidCents: 100 }),
        expense({ id: 'e2', paidBy: 'Ben', pfandPaidCents: 250 }),
      ],
      [entry({ id: 'p2', payer: 'Ben', amountCents: 200 })],
      'Ben',
    )
    const balances = pfandBalances(ledger)
    expect(pfandBalanceCents(balances, 'Anna')).toBe(0)
    expect(pfandBalanceCents(balances, 'Ben')).toBe(150)
  })

  it('treats two spellings of one name as one pocket, showing the newest', () => {
    const ledger = pfandLedger(
      [
        expense({ id: 'e1', paidBy: 'anna', pfandPaidCents: 100, date: '2026-07-10' }),
        expense({ id: 'e2', paidBy: ' Anna ', pfandPaidCents: 25, date: '2026-07-12' }),
      ],
      [],
    )
    expect(pfandBalances(ledger)).toEqual([{ name: 'Anna', outstandingCents: 125, txnCount: 2 }])
  })

  it('reports a negative balance rather than hiding it', () => {
    // More came back than went out — packaging brought from home. Odd, but it is what the
    // rows say, and the screen is where it gets noticed.
    const ledger = pfandLedger([], [entry({ amountCents: 300 })])
    expect(pfandBalanceCents(pfandBalances(ledger), 'Anna')).toBe(-300)
  })

  it('is empty for an empty ledger', () => {
    expect(pfandBalances([])).toEqual([])
    expect(pfandBalanceCents([], 'Anna')).toBe(0)
  })

  it('sorts the biggest debt first', () => {
    const ledger = pfandLedger(
      [
        expense({ id: 'e1', paidBy: 'Anna', pfandPaidCents: 100 }),
        expense({ id: 'e2', paidBy: 'Ben', pfandPaidCents: 400 }),
      ],
      [],
    )
    expect(pfandBalances(ledger).map((b) => b.name)).toEqual(['Ben', 'Anna'])
  })
})

describe('isPfandEntry', () => {
  it('accepts a refund', () => {
    expect(isPfandEntry(entry())).toBe(true)
  })

  it('rejects a stored handover, which the ledger now derives from the receipt', () => {
    // Rows an earlier build wrote when a transfer was a row of its own. Reading one now
    // would count the same transfer twice: once from the row, once from the receipt.
    expect(isPfandEntry({ ...entry(), kind: 'handover', toPayer: 'Ben' })).toBe(false)
  })

  it('rejects an unknown kind and a missing field', () => {
    // 'purchase' was a kind once; a row still carrying it is not one this build can read.
    expect(isPfandEntry({ ...entry(), kind: 'purchase' })).toBe(false)
    expect(isPfandEntry({ ...entry(), amountCents: undefined })).toBe(false)
    expect(isPfandEntry(null)).toBe(false)
  })
})

describe('pfandIssues', () => {
  it('is empty for a complete draft', () => {
    expect(pfandIssues(draft())).toEqual([])
  })

  it('wants a payer, an amount and a date', () => {
    expect(pfandIssues(draft({ payer: '  ' }))).toContain('payer')
    expect(pfandIssues(draft({ amount: '' }))).toContain('amount')
    expect(pfandIssues(draft({ amount: '0' }))).toContain('amount')
    expect(pfandIssues(draft({ date: '' }))).toContain('date')
  })
})

describe('pfandDraftToInput', () => {
  it('converts euros to cents and drops an empty note', () => {
    const input = pfandDraftToInput(draft({ amount: '1,25' }), 'c1', null)
    expect(input?.fields).toEqual({
      campId: 'c1',
      payer: 'Anna',
      amountCents: 125,
      date: '2026-07-15',
      note: undefined,
    })
  })

  it('refuses an invalid draft rather than writing a broken row', () => {
    expect(pfandDraftToInput(draft({ amount: 'x' }), 'c1', null)).toBeNull()
  })
})

describe('drafts', () => {
  it('starts blank on today, prefilled with whoever it is about', () => {
    expect(blankPfandDraft('2026-07-14', 'Anna', 250)).toEqual({
      payer: 'Anna',
      amount: '2,50',
      date: '2026-07-14',
      note: '',
    })
  })

  it('leaves the amount empty when there is nothing to prefill', () => {
    expect(blankPfandDraft('2026-07-14', '', 0).amount).toBe('')
  })

  it('round-trips a stored refund', () => {
    const row: PfandEntry = {
      id: 'p1',
      campId: 'c1',
      kind: 'refund',
      payer: 'Anna',
      amountCents: 175,
      date: '2026-07-15',
      note: 'at camp',
      createdAt: 2000,
    }
    const input = pfandDraftToInput(draftFromPfandEntry(row), 'c1', row)
    expect(input?.fields).toMatchObject({ payer: 'Anna', amountCents: 175 })
    expect(input?.existing).toBe(row)
  })
})

describe('pfandOwner', () => {
  it('is the payer while the receipt is still owed', () => {
    expect(pfandOwner(expense({ paidBy: 'Anna' }), 'Ben')).toBe('Anna')
  })

  it('is the money holder once the receipt has been paid back', () => {
    expect(pfandOwner(expense({ paidBy: ' Anna ', reimbursed: true }), ' Ben ')).toBe('Ben')
  })

  it('stays the payer when the holder paid it themselves, whatever the spelling', () => {
    expect(pfandOwner(expense({ paidBy: 'anna', reimbursed: true }), 'Anna')).toBe('anna')
  })

  it('stays the payer when the camp has named no holder', () => {
    expect(pfandOwner(expense({ paidBy: 'Anna', reimbursed: true }), undefined)).toBe('Anna')
  })
})

describe('the ledger is derived, never accumulated', () => {
  const later = expense({ id: 'e2', date: '2026-07-20', createdAt: 2000, pfandPaidCents: 50 })
  const earlier = expense({ id: 'e1', date: '2026-07-10', createdAt: 1000, pfandPaidCents: 100 })

  it('gives the same balance whichever order the receipts arrive in', () => {
    // Rows come back from a query in no guaranteed order, and a receipt for last Tuesday can
    // be typed in today. A balance is a sum, so neither can change it.
    const one = pfandBalances(pfandLedger([earlier, later], []))
    const other = pfandBalances(pfandLedger([later, earlier], []))
    expect(one).toEqual(other)
    expect(pfandBalanceCents(one, 'Anna')).toBe(150)
  })

  it('drops a deleted receipt’s lines and its balance with them', () => {
    // Nothing is stored per receipt, so removing one from the input is the whole of what
    // deleting it does to the ledger.
    const after = pfandBalances(pfandLedger([later], []))
    expect(pfandBalanceCents(after, 'Anna')).toBe(50)
    expect(pfandLedger([later], []).map((txn) => txn.rowId)).toEqual(['e2'])
  })

  it('re-nets when a receipt in the middle changes direction', () => {
    const corrected = { ...earlier, pfandPaidCents: 0, pfandReturnedCents: 100 }
    const balances = pfandBalances(pfandLedger([corrected, later], []))
    expect(pfandBalanceCents(balances, 'Anna')).toBe(-50)
  })

  it('takes a transfer back the moment the receipt is un-ticked', () => {
    // The holder charges a deposit; a co-leader's receipt gives part of one back. Paying
    // the co-leader off hands their side to the holder, and undoing that puts it back —
    // both read off the same flag, so an undo cannot leave a transfer standing.
    const holders = expense({ id: 'e1', paidBy: 'Anna', pfandPaidCents: 50 })
    const bens = expense({ id: 'e2', paidBy: 'Ben', pfandReturnedCents: 25 })

    const owed = pfandBalances(pfandLedger([holders, bens], [], 'Anna'))
    expect(pfandBalanceCents(owed, 'Anna')).toBe(50)
    expect(pfandBalanceCents(owed, 'Ben')).toBe(-25)

    const settled = pfandBalances(pfandLedger([holders, { ...bens, reimbursed: true }], [], 'Anna'))
    expect(pfandBalanceCents(settled, 'Anna')).toBe(25)
    expect(pfandBalanceCents(settled, 'Ben')).toBe(0)

    // Un-ticking is the same input as before it was ticked, so it is the same answer.
    expect(pfandBalances(pfandLedger([holders, bens], [], 'Anna'))).toEqual(owed)
  })

  it('follows an edit made after the receipt was paid back', () => {
    // Nothing was copied at tick time, so correcting the amount lands on the holder's
    // balance rather than on a transfer written when the number was different.
    const settled = expense({ paidBy: 'Ben', reimbursed: true, pfandPaidCents: 100 })
    const fixed = { ...settled, pfandPaidCents: 40 }
    expect(pfandBalanceCents(pfandBalances(pfandLedger([fixed], [], 'Anna')), 'Anna')).toBe(40)
  })
})

describe('netPfandCents', () => {
  it('is what the receipt put into the payer’s pocket, less what it took back', () => {
    expect(netPfandCents(expense({ pfandPaidCents: 50, pfandReturnedCents: 75 }))).toBe(-25)
    expect(netPfandCents(expense({ pfandPaidCents: 100 }))).toBe(100)
    expect(netPfandCents(expense())).toBe(0)
  })
})
