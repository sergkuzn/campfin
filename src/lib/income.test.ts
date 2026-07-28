import { describe, expect, it } from 'vitest'
import { emptyIncome, incomeReducer } from './income'
import type { Contribution, PassthroughSource, PerDiemBlock, PerDiemSource } from './types'

const perDiem: PerDiemSource = {
  id: 'src-pd',
  campId: 'C',
  kind: 'per_diem',
  use: 'gradual',
  name: 'Per diem',
  createdAt: 1,
}
const block: PerDiemBlock = {
  id: 'blk-1',
  campId: 'C',
  sourceId: 'src-pd',
  numPersons: 10,
  ratePerPersonDayCents: 1200,
  startDate: '2026-07-01',
  endDate: '2026-07-14',
}
const passthrough: PassthroughSource = {
  id: 'src-pt',
  campId: 'C',
  kind: 'passthrough',
  use: 'passthrough',
  name: 'Volunteers',
  createdAt: 2,
}
const contribution: Contribution = {
  id: 'con-1',
  campId: 'C',
  sourceId: 'src-pt',
  name: 'J.',
  amountCents: 5000,
  date: '2026-07-02',
  createdAt: 3,
}

describe('incomeReducer sourceDeleted cascade', () => {
  const start = incomeReducer(emptyIncome, {
    type: 'loaded',
    state: {
      sources: [perDiem, passthrough],
      blocks: [block],
      contributions: [contribution],
    },
  })

  it('removes the source and its blocks', () => {
    const next = incomeReducer(start, { type: 'sourceDeleted', sourceId: 'src-pd' })
    expect(next.sources.map((s) => s.id)).toEqual(['src-pt'])
    expect(next.blocks).toEqual([]) // orphaned block is gone
    expect(next.contributions).toHaveLength(1) // other source untouched
  })

  it('removes the source and its contributions', () => {
    const next = incomeReducer(start, { type: 'sourceDeleted', sourceId: 'src-pt' })
    expect(next.contributions).toEqual([])
    expect(next.blocks).toHaveLength(1)
  })

  it('does not mutate the previous state', () => {
    incomeReducer(start, { type: 'sourceDeleted', sourceId: 'src-pd' })
    expect(start.blocks).toHaveLength(1) // start is unchanged
  })
})
