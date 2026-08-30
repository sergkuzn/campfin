/**
 * Writes for one camp's pfand entries. Reads live in `src/hooks/usePfand.ts`.
 *
 * Same shape as `movementsDb.ts` — an entry owns nothing, so there is no cascade to plan.
 * Ids and timestamps are minted here, which is what keeps `src/lib/` pure.
 *
 * One row shape, one write: a refund taken at a shop. Everything else the pfand ledger
 * shows is derived from the receipts, so there is nothing here to keep in step with them.
 */

import { id } from '@instantdb/react'
import type { SavePfandInput } from '../lib/pfand'
import { chunk, db } from './instant'

/**
 * Create or update one entry. `update` on an existing id is a merge, so editing a row
 * keeps its `createdAt` and the ledger's within-a-day order stays stable across an edit.
 */
export function savePfandEntry(input: SavePfandInput): Promise<unknown> {
  const now = Date.now()
  const entryId = input.existing?.id ?? id()
  const createdAt = input.existing?.createdAt ?? now
  const fields = input.fields

  return db.transact(
    chunk(db.tx.pfandEntries[entryId])
      .update({
        campId: fields.campId,
        // Written even though there is only one kind: it is what lets a row from the build
        // that also stored transfers be recognised and skipped, instead of being read as a
        // refund and counted against somebody's balance.
        kind: 'refund',
        payer: fields.payer,
        amountCents: fields.amountCents,
        date: fields.date,
        note: fields.note ?? null,
        createdAt,
      })
      // Permission rules can only traverse links, so the camp link is what makes this row
      // readable by the camp's members at all.
      .link({ camp: fields.campId }),
  )
}

export function deletePfandEntry(entryId: string): Promise<unknown> {
  return db.transact(chunk(db.tx.pfandEntries[entryId]).delete())
}
