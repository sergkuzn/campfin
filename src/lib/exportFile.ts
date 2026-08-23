/**
 * What a camp's export is called on disk. Its own module because the name is app-level
 * business — the CSV's content is built by the report screen from the dictionary, and
 * `src/lib/` never sees a label.
 */

import type { Camp } from './types'

/** A filename that sorts by date and survives a phone's file picker. */
export function exportFileName(camp: Camp, exportedAt: string, extension: 'csv' = 'csv'): string {
  const day = exportedAt.slice(0, 10) // the date half of an ISO timestamp
  const slug = camp.name.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'camp'
  return `campfin-${slug}-${day}.${extension}`
}
