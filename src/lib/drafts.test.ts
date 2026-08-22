import { describe, expect, it } from 'vitest'
import {
  type BlockDraft,
  blankBlockDraft,
  blockDraftCents,
  blockDraftPersonDays,
  blockDraftsIssues,
  blockDraftsToInput,
  blockDraftToInput,
  centsToEuroInput,
  copyBlockDraft,
  copyDraftsFromBlocks,
  draftFromSource,
  draftIssues,
  draftPersonDays,
  draftsFromBlocks,
  draftToInput,
  kindNeedsName,
  type PoolDraft,
  poolDraftIssues,
  poolDraftToInput,
  type SourceDraft,
} from './drafts'
import { parseEurosToCents } from './money'
import type { AmountSource, PerDiemBlock, PerDiemSource } from './types'

const perDiem: PerDiemSource = {
  id: 'src-pd',
  campId: 'C',
  poolId: 'pool-e',
  kind: 'per_diem',
  name: 'Verpflegungspauschale',
  createdAt: 1,
}
const food: AmountSource = {
  id: 'src-food',
  campId: 'C',
  poolId: 'pool-e',
  kind: 'fixed',
  name: 'Extra food',
  amountCents: 1999,
  createdAt: 2,
}

const persistedBlock: PerDiemBlock = {
  id: 'blk-1',
  campId: 'C',
  sourceId: 'src-pd',
  variant: 'granted',
  label: 'Participants',
  numPersons: 18,
  ratePerPersonDayCents: 1250,
  startDate: '2026-08-12',
  endDate: '2026-08-19',
}

const goodBlock = (over: Partial<BlockDraft> = {}): BlockDraft => ({
  ...blankBlockDraft('k1'),
  persons: '4',
  startDate: '2026-07-01',
  endDate: '2026-07-03',
  rate: '10,00',
  ...over,
})

const goodDraft = (over: Partial<SourceDraft> = {}): SourceDraft => ({
  kind: 'fixed',
  name: 'Extra food',
  amount: '300',
  blocks: [],
  ...over,
})

describe('centsToEuroInput', () => {
  it('renders cents as a plain comma-decimal string', () => {
    expect(centsToEuroInput(1250)).toBe('12,50')
    expect(centsToEuroInput(0)).toBe('0,00')
    expect(centsToEuroInput(212_500)).toBe('2125,00') // no thousands separator
  })

  it('round-trips back through parseEurosToCents', () => {
    for (const cents of [1250, 1999, 1, 212_500, 0]) {
      expect(parseEurosToCents(centsToEuroInput(cents))).toBe(cents)
    }
  })
})

describe('draftFromSource', () => {
  it('starts blank for a new source', () => {
    expect(draftFromSource('fixed', null, [])).toEqual({
      kind: 'fixed',
      name: '',
      amount: '',
      blocks: [],
    })
  })

  it('turns an amount source into strings', () => {
    expect(draftFromSource('fixed', food, [])).toMatchObject({
      name: 'Extra food',
      amount: '19,99',
    })
  })

  it('shows an unnamed source as a blank name, so the pool keeps answering for it', () => {
    const unnamed: AmountSource = { ...food, name: undefined }
    expect(draftFromSource('fixed', unnamed, []).name).toBe('')
  })

  it('turns per-diem blocks into rows keyed by their database id', () => {
    const draft = draftFromSource('per_diem', perDiem, [persistedBlock])
    expect(draft.amount).toBe('') // per-diem money is computed, never typed
    expect(draft.blocks).toEqual([
      {
        id: 'blk-1',
        key: 'blk-1',
        label: 'Participants',
        persons: '18',
        startDate: '2026-08-12',
        endDate: '2026-08-19',
        rate: '12,50',
      },
    ])
  })
})

describe('copyBlockDraft', () => {
  it('copies every field but resets id and key', () => {
    const source = goodBlock({ id: 'blk-1', label: 'Participants' })
    expect(copyBlockDraft(source, 'k2')).toEqual({
      ...source,
      id: null,
      key: 'k2',
    })
  })

  it('carries over a half-typed row as-is, so the copy needs the same fix as the original', () => {
    const half = blankBlockDraft('k1')
    expect(copyBlockDraft(half, 'k2')).toEqual({ ...half, id: null, key: 'k2' })
  })
})

describe('the actual-attendance editor', () => {
  let counter = 0
  const newKey = () => `new-${++counter}`

  it('copies granted blocks as new rows with fresh keys and no ids', () => {
    counter = 0
    const copies = copyDraftsFromBlocks([persistedBlock], newKey)
    expect(copies).toEqual([
      {
        id: null, // a copy is a new row, not a move of the granted one
        key: 'new-1',
        label: 'Participants',
        persons: '18',
        startDate: '2026-08-12',
        endDate: '2026-08-19',
        rate: '12,50',
      },
    ])
  })

  it('keeps ids when seeding from existing actual blocks', () => {
    const stored: PerDiemBlock = { ...persistedBlock, id: 'blk-a', variant: 'actual' }
    expect(draftsFromBlocks([stored])[0]).toMatchObject({ id: 'blk-a', key: 'blk-a' })
  })

  it('accepts an empty list — no actual blocks means actual is granted', () => {
    expect(blockDraftsIssues([])).toEqual([])
    expect(blockDraftsToInput([], 'C', 'src-pd', 'actual')).toEqual({
      campId: 'C',
      sourceId: 'src-pd',
      variant: 'actual',
      blocks: [],
    })
  })

  it('rejects the save while a row is half typed', () => {
    const rows = [goodBlock(), goodBlock({ key: 'k2', persons: '' })]
    expect(blockDraftsIssues(rows)).toEqual(['invalidBlock'])
    expect(blockDraftsToInput(rows, 'C', 'src-pd', 'actual')).toBeNull()
  })

  it('stamps the actual variant onto every row', () => {
    const input = blockDraftsToInput(
      [goodBlock(), goodBlock({ key: 'k2' })],
      'C',
      'src-pd',
      'actual',
    )
    expect(input?.blocks.map((b) => b.variant)).toEqual(['actual', 'actual'])
  })
})

describe('draft round trip', () => {
  it('preserves an amount to the cent — including the 19,99 float trap', () => {
    const draft = draftFromSource('fixed', food, [])
    const input = draftToInput(draft, 'C', 'pool-e', food)
    expect(input?.amountCents).toBe(1999)
  })

  it('preserves per-diem blocks unchanged', () => {
    const draft = draftFromSource('per_diem', perDiem, [persistedBlock])
    const input = draftToInput(draft, 'C', 'pool-e', perDiem)
    expect(input?.amountCents).toBeNull()
    expect(input?.blocks).toEqual([
      {
        id: 'blk-1',
        variant: 'granted',
        label: 'Participants',
        numPersons: 18,
        ratePerPersonDayCents: 1250,
        startDate: '2026-08-12',
        endDate: '2026-08-19',
      },
    ])
  })
})

describe('blockDraftToInput', () => {
  it('accepts a complete row and trims the label away when empty', () => {
    expect(blockDraftToInput(goodBlock())).toEqual({
      id: null,
      variant: 'granted',
      label: undefined,
      numPersons: 4,
      ratePerPersonDayCents: 1000,
      startDate: '2026-07-01',
      endDate: '2026-07-03',
    })
  })

  it('rejects zero, fractional or missing people', () => {
    expect(blockDraftToInput(goodBlock({ persons: '0' }))).toBeNull()
    expect(blockDraftToInput(goodBlock({ persons: '2,5' }))).toBeNull()
    expect(blockDraftToInput(goodBlock({ persons: '2.5' }))).toBeNull()
    expect(blockDraftToInput(goodBlock({ persons: '' }))).toBeNull()
  })

  it('rejects a missing or non-positive rate', () => {
    expect(blockDraftToInput(goodBlock({ rate: '' }))).toBeNull()
    expect(blockDraftToInput(goodBlock({ rate: '0' }))).toBeNull()
    expect(blockDraftToInput(goodBlock({ rate: 'abc' }))).toBeNull()
  })

  it('rejects missing dates or an end before the start', () => {
    expect(blockDraftToInput(goodBlock({ startDate: '' }))).toBeNull()
    expect(blockDraftToInput(goodBlock({ endDate: '' }))).toBeNull()
    expect(blockDraftToInput(goodBlock({ endDate: '2026-06-30' }))).toBeNull()
  })

  it('accepts a single-day block (start === end)', () => {
    expect(blockDraftToInput(goodBlock({ endDate: '2026-07-01' }))).not.toBeNull()
  })
})

describe('blockDraftCents', () => {
  it('prices a valid row', () => {
    expect(blockDraftCents(goodBlock())).toBe(12_000) // 4 × 3 days × 1000
  })

  it('is null while the row is incomplete', () => {
    expect(blockDraftCents(blankBlockDraft('k'))).toBeNull()
  })
})

describe('blockDraftPersonDays', () => {
  it('multiplies people by inclusive days', () => {
    expect(blockDraftPersonDays(goodBlock())).toBe(12) // 4 people × 3 days
  })

  it('counts a single-day block as one day per person', () => {
    expect(blockDraftPersonDays(goodBlock({ endDate: '2026-07-01' }))).toBe(4)
  })

  it('ignores the rate — the count shows before any money is typed', () => {
    expect(blockDraftPersonDays(goodBlock({ rate: '' }))).toBe(12)
  })

  it('is null while people or dates are unusable', () => {
    expect(blockDraftPersonDays(blankBlockDraft('k'))).toBeNull()
    expect(blockDraftPersonDays(goodBlock({ persons: '0' }))).toBeNull()
    expect(blockDraftPersonDays(goodBlock({ persons: '2,5' }))).toBeNull()
    expect(blockDraftPersonDays(goodBlock({ startDate: '2026-07-05' }))).toBeNull() // after end
  })
})

describe('draftPersonDays', () => {
  it('sums the rows, counting half-typed ones as zero', () => {
    const rows = [goodBlock(), goodBlock({ key: 'k2', persons: '1' }), blankBlockDraft('k3')]
    expect(draftPersonDays(rows)).toBe(15) // 12 + 3 + 0
  })

  it('is zero with no blocks', () => {
    expect(draftPersonDays([])).toBe(0)
  })
})

describe('draftIssues', () => {
  it('is empty for a valid fixed draft', () => {
    expect(draftIssues(goodDraft())).toEqual([])
  })

  it('lets a blank name pass — an unnamed income goes by its pool', () => {
    expect(draftIssues(goodDraft({ name: '  ' }))).toEqual([])
  })

  it('flags a missing or zero amount on fixed and deposit', () => {
    expect(draftIssues(goodDraft({ amount: '' }))).toEqual(['amount'])
    expect(draftIssues(goodDraft({ kind: 'deposit', amount: '0' }))).toEqual(['amount'])
  })

  it('flags a per-diem with no blocks, and passes with one good block', () => {
    expect(draftIssues(goodDraft({ kind: 'per_diem', blocks: [] }))).toEqual(['noBlocks'])
    expect(draftIssues(goodDraft({ kind: 'per_diem', blocks: [goodBlock()] }))).toEqual([])
  })

  it('flags a per-diem whose block is half-filled', () => {
    const blocks = [goodBlock(), goodBlock({ key: 'k2', rate: '' })]
    expect(draftIssues(goodDraft({ kind: 'per_diem', blocks }))).toEqual(['invalidBlock'])
  })
})

describe('draftToInput', () => {
  it('returns null whenever draftIssues is non-empty', () => {
    expect(draftToInput(goodDraft({ amount: 'x' }), 'C', 'pool-e', null)).toBeNull()
    expect(draftToInput(goodDraft({ kind: 'per_diem' }), 'C', 'pool-e', null)).toBeNull()
  })

  it('stamps every block with the variant being edited, granted by default', () => {
    const draft = goodDraft({ kind: 'per_diem', blocks: [goodBlock(), goodBlock({ key: 'k2' })] })
    expect(draftToInput(draft, 'C', 'pool-e', null)?.blocks.map((b) => b.variant)).toEqual([
      'granted',
      'granted',
    ])
    expect(
      draftToInput(draft, 'C', 'pool-e', null, 'actual')?.blocks.map((b) => b.variant),
    ).toEqual(['actual', 'actual'])
  })

  it('saves the income into the pool the form was opened in', () => {
    expect(draftToInput(goodDraft(), 'C', 'pool-bikes', null)?.poolId).toBe('pool-bikes')
  })

  it('keeps a trimmed name for a fixed grant', () => {
    expect(draftToInput(goodDraft({ name: '  Bakery  ' }), 'C', 'pool-e', null)?.name).toBe(
      'Bakery',
    )
  })

  it('sends a null name for a blank one, so the income falls back to its pool', () => {
    expect(draftToInput(goodDraft({ name: '   ' }), 'C', 'pool-e', null)?.name).toBeNull()
  })

  it('sends a null name for the kinds that are never asked for one', () => {
    const perDiemDraft = goodDraft({
      kind: 'per_diem',
      name: 'typed anyway',
      blocks: [goodBlock()],
    })
    expect(draftToInput(perDiemDraft, 'C', 'pool-e', null)?.name).toBeNull()
    const depositDraft = goodDraft({ kind: 'deposit', name: 'typed anyway' })
    expect(draftToInput(depositDraft, 'C', 'pool-e', null)?.name).toBeNull()
  })

  it('carries the existing row through so its id and createdAt survive an edit', () => {
    expect(draftToInput(goodDraft(), 'C', 'pool-e', food)?.existing).toBe(food)
  })

  it('sends no blocks for a non-per-diem source, even if the draft carries some', () => {
    const input = draftToInput(goodDraft({ blocks: [goodBlock()] }), 'C', 'pool-e', null)
    expect(input?.blocks).toEqual([])
  })
})

describe('kindNeedsName', () => {
  it('asks only for a fixed grant, which is the only kind that can have a sibling', () => {
    expect(kindNeedsName('fixed')).toBe(true)
    expect(kindNeedsName('per_diem')).toBe(false)
    expect(kindNeedsName('deposit')).toBe(false)
  })
})

describe('the pool form', () => {
  const poolDraft = (over: Partial<PoolDraft> = {}): PoolDraft => ({
    name: 'Bike hire',
    role: 'earmarked',
    ...over,
  })

  it('needs a name — it is the one name the pool and its only income share', () => {
    expect(poolDraftIssues(poolDraft({ name: '  ' }))).toEqual(['poolName'])
    expect(poolDraftIssues(poolDraft())).toEqual([])
    expect(poolDraftToInput(poolDraft({ name: '' }), 'C')).toBeNull()
  })

  it('trims the name and carries the role through', () => {
    expect(poolDraftToInput(poolDraft({ name: '  Bikes  ', role: 'deposit' }), 'C')).toEqual({
      campId: 'C',
      name: 'Bikes',
      role: 'deposit',
    })
  })
})
