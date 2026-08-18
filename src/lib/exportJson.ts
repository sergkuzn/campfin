/**
 * The escape hatch: one camp's rows as a plain object, ready to be stringified and saved.
 * It exists so the data can leave the phone by hand — a free tier that pauses, an evicted
 * IndexedDB or a lost account should never be the end of a camp's books.
 *
 * Pure, and versioned: a later build reading an old dump needs to know which shape it is
 * looking at. `version` tracks the row shapes (v3 = pools have roles, blocks have
 * variants; v4 = the dump carries the camp's expenses too; v5 = and its custody
 * movements; v6 = a handover can be marked as completing its deposit; v7 = pools carry a
 * colour and receipts an optional number).
 */

import type { IncomeState } from './income'
import type { Camp, Expense, IncomeSource, Movement, PerDiemBlock, Pool } from './types'

export type CampExport = {
  format: 'campfin.camp'
  version: 7
  /** ISO timestamp, passed in — a pure function does not read the clock. */
  exportedAt: string
  camp: Camp
  pools: Pool[]
  sources: IncomeSource[]
  blocks: PerDiemBlock[]
  expenses: Expense[]
  movements: Movement[]
}

export function buildCampExport(
  camp: Camp,
  state: IncomeState,
  expenses: Expense[],
  movements: Movement[],
  exportedAt: string,
): CampExport {
  return {
    format: 'campfin.camp',
    version: 7,
    exportedAt,
    camp,
    pools: state.pools,
    sources: state.sources,
    blocks: state.blocks,
    expenses,
    movements,
  }
}

/** A filename that sorts by date and survives a phone's file picker. The same stem for
 *  both exports, so the JSON backup and the CSV for accounting sit next to each other. */
export function exportFileName(
  camp: Camp,
  exportedAt: string,
  extension: 'json' | 'csv' = 'json',
): string {
  const day = exportedAt.slice(0, 10) // the date half of an ISO timestamp
  const slug = camp.name.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'camp'
  return `campfin-${slug}-${day}.${extension}`
}
