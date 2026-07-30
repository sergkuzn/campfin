import { describe, expect, it } from 'vitest'
import {
  type BlockDraft,
  blankBlockDraft,
  blockDraftCents,
  blockDraftPersonDays,
  blockDraftToInput,
  centsToEuroInput,
  draftFromSource,
  draftIssues,
  draftPersonDays,
  draftToInput,
  NEW_POOL,
  type SourceDraft,
} from './drafts'
import { parseEurosToCents } from './money'
import type { AmountSource, PerDiemBlock, PerDiemSource, Pool } from './types'

const everyday: Pool = {
  id: 'pool-e',
  campId: 'C',
  name: 'Everyday',
  role: 'everyday',
  createdAt: 1,
}

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
  poolChoice: 'pool-e',
  newPoolName: '',
  blocks: [],
  ...over,
})

describe('centsToEuroInput', () => {
  it('renders cents as a plain comma-decimal string', () => {
    expect(centsToEuroInput(1250)).toBe('8,00')
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
  it('starts blank for a new source, pre-selecting the default pool', () => {
    const draft = draftFromSource('fixed', null, [], everyday)
    expect(draft).toEqual({
      kind: 'fixed',
      name: '',
      amount: '',
      poolChoice: 'pool-e',
      newPoolName: '',
      blocks: [],
    })
  })

  it('falls back to "new pool" when there is no default', () => {
    expect(draftFromSource('deposit', null, [], undefined).poolChoice).toBe(NEW_POOL)
  })

  it('turns an amount source into strings', () => {
    const draft = draftFromSource('fixed', food, [], undefined)
    expect(draft).toMatchObject({ name: 'Extra food', amount: '19,99', poolChoice: 'pool-e' })
  })

  it('turns per-diem blocks into rows keyed by their database id', () => {
    const draft = draftFromSource('per_diem', perDiem, [persistedBlock], undefined)
    expect(draft.amount).toBe('') // per-diem money is computed, never typed
    expect(draft.blocks).toEqual([
      {
        id: 'blk-1',
        key: 'blk-1',
        label: 'Participants',
        persons: '18',
        startDate: '2026-08-12',
        endDate: '2026-08-19',
        rate: '8,00',
      },
    ])
  })
})

describe('draft round trip', () => {
  it('preserves an amount to the cent — including the 19,99 float trap', () => {
    const draft = draftFromSource('fixed', food, [], undefined)
    const input = draftToInput(draft, 'C', food)
    expect(input?.amountCents).toBe(1999)
  })

  it('preserves per-diem blocks unchanged', () => {
    const draft = draftFromSource('per_diem', perDiem, [persistedBlock], undefined)
    const input = draftToInput(draft, 'C', perDiem)
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

  it('flags a missing name', () => {
    expect(draftIssues(goodDraft({ name: '  ' }))).toEqual(['name'])
  })

  it('flags a new pool with no name, and clears once named', () => {
    expect(draftIssues(goodDraft({ poolChoice: NEW_POOL }))).toEqual(['poolName'])
    expect(draftIssues(goodDraft({ poolChoice: NEW_POOL, newPoolName: 'Bikes' }))).toEqual([])
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
    expect(draftToInput(goodDraft({ name: '' }), 'C', null)).toBeNull()
    expect(draftToInput(goodDraft({ amount: 'x' }), 'C', null)).toBeNull()
  })

  it('stamps every block with the variant being edited, granted by default', () => {
    const draft = goodDraft({ kind: 'per_diem', blocks: [goodBlock(), goodBlock({ key: 'k2' })] })
    expect(draftToInput(draft, 'C', null)?.blocks.map((b) => b.variant)).toEqual([
      'granted',
      'granted',
    ])
    expect(draftToInput(draft, 'C', null, 'actual')?.blocks.map((b) => b.variant)).toEqual([
      'actual',
      'actual',
    ])
  })

  it('maps a new-pool choice to a new-pool payload', () => {
    const draft = goodDraft({ poolChoice: NEW_POOL, newPoolName: '  Bikes  ' })
    expect(draftToInput(draft, 'C', null)?.pool).toEqual({ mode: 'new', name: 'Bikes' })
  })

  it('carries the existing row through so its id and createdAt survive an edit', () => {
    expect(draftToInput(goodDraft(), 'C', food)?.existing).toBe(food)
  })

  it('sends no blocks for a non-per-diem source, even if the draft carries some', () => {
    const input = draftToInput(goodDraft({ blocks: [goodBlock()] }), 'C', null)
    expect(input?.blocks).toEqual([])
  })
})
