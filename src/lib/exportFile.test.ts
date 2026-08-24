import { describe, expect, it } from 'vitest'
import { exportFileName } from './exportFile'
import type { Camp } from './types'

const camp: Camp = {
  id: 'c1',
  name: 'Moorwerder Sommercamp',
  joinCode: 'MOOR-7F3K',
  createdAt: 1_700_000_000_000,
}

describe('exportFileName', () => {
  it('slugifies the camp name and dates the file', () => {
    expect(exportFileName(camp, '2026-07-29T10:00:00.000Z')).toBe(
      'campfin-Moorwerder-Sommercamp-2026-07-29.csv',
    )
  })

  it('falls back to a usable name when the camp name has no letters', () => {
    expect(exportFileName({ ...camp, name: '!!!' }, '2026-07-29T10:00:00.000Z')).toBe(
      'campfin-camp-2026-07-29.csv',
    )
  })
})
