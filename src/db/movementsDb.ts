/**
 * Writes for one camp's custody movements. Reads live in `src/hooks/useMovements.ts`.
 *
 * Same shape as `expensesDb.ts` — a movement owns nothing, so there is no cascade to plan.
 * Ids and timestamps are minted here, which is what keeps `src/lib/` pure.
 */

import { id } from '@instantdb/react'
import type { SaveMovementInput } from '../lib/movements'
import { chunk, db } from './instant'

/**
 * Create or update one movement. `update` on an existing id is a merge, so editing a row
 * keeps its `createdAt` and the list's within-a-day order stays stable across an edit.
 */
export function saveMovement(input: SaveMovementInput): Promise<unknown> {
  const now = Date.now()
  const movementId = input.existing?.id ?? id()
  const createdAt = input.existing?.createdAt ?? now
  const fields = input.fields

  return db.transact(
    chunk(db.tx.movements[movementId])
      .update({
        campId: fields.campId,
        kind: fields.kind,
        name: fields.name,
        amountCents: fields.amountCents,
        date: fields.date,
        // null clears the attribute. Both optionals need it: changing a deposit row into
        // volunteer money must actually drop its pool, or a stale pool id would survive
        // the edit and the row would come back through the guard as a deposit.
        // Comparing the discriminant (rather than calling a helper) is what lets
        // TypeScript narrow the union and see `poolId` on the deposit branch.
        poolId: fields.kind === 'volunteer_in' ? null : fields.poolId,
        note: fields.note ?? null,
        createdAt,
      })
      // Permission rules can only traverse links, so the camp link is what makes this row
      // readable by the camp's members at all.
      .link({ camp: fields.campId }),
  )
}

export function deleteMovement(movementId: string): Promise<unknown> {
  return db.transact(chunk(db.tx.movements[movementId]).delete())
}
