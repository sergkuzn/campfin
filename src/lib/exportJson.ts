/**
 * The escape hatch: one camp's rows as a plain object, ready to be stringified and saved.
 * It exists so the data can leave the phone by hand — a free tier that pauses, an evicted
 * IndexedDB or a lost account should never be the end of a camp's books.
 *
 * Pure, and versioned: a later build reading an old dump needs to know which shape it is
 * looking at. `version` tracks the row shapes (v3 = pools have roles, blocks have variants).
 */

import type { IncomeState } from './income'
import type { Camp, IncomeSource, PerDiemBlock, Pool } from './types'

export type CampExport = {
  format: 'campfin.camp'
  version: 3
  /** ISO timestamp, passed in — a pure function does not read the clock. */
  exportedAt: string
  camp: Camp
  pools: Pool[]
  sources: IncomeSource[]
  blocks: PerDiemBlock[]
}

export function buildCampExport(camp: Camp, state: IncomeState, exportedAt: string): CampExport {
  return {
    format: 'campfin.camp',
    version: 3,
    exportedAt,
    camp,
    pools: state.pools,
    sources: state.sources,
    blocks: state.blocks,
  }
}

/** A filename that sorts by date and survives a phone's file picker. */
export function exportFileName(camp: Camp, exportedAt: string): string {
  const day = exportedAt.slice(0, 10) // the date half of an ISO timestamp
  const slug = camp.name.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'camp'
  return `campfin-${slug}-${day}.json`
}
