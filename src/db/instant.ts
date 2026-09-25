/**
 * The one InstantDB client. Everything that touches the database goes through `db`, and
 * everything that touches `db` lives in this folder:
 *
 * - **writes** are the small typed helpers in `campsDb.ts` / `incomeDb.ts`,
 * - **reads** are the live queries inside `src/hooks/`, where a query object keeps its
 *   inferred result type (passing one through a helper loses it),
 * - **rows** come back through `rows.ts`, which is the untrusted boundary.
 *
 * Components never import from here. That is what kept `src/lib/` — all of the budget
 * math — testable without a database, and what makes this swappable at all.
 */

import { init } from '@instantdb/react'
import schema from '../../instant.schema'

// A Vite env var is inlined at build time, so a missing one is a broken build, not a
// runtime surprise on a phone at camp — say so loudly and immediately.
const appId = import.meta.env.VITE_INSTANT_APP_ID
if (typeof appId !== 'string' || appId === '') {
  throw new Error('VITE_INSTANT_APP_ID is not set — copy .env.example to .env.dev.local')
}

/**
 * `init` with the schema attached: queries know their result shape and `db.tx` rejects a
 * field that isn't in the namespace. Instant caches queries in IndexedDB and queues writes
 * while offline, which is the whole local-first story — there is no second storage layer.
 */
export const db = init({ appId, schema })

/**
 * `db.tx.pools[someId]` is an index access, and `noUncheckedIndexedAccess` (on, deliberately)
 * therefore types it as possibly undefined — while the proxy behind `db.tx` in fact mints a
 * chunk for any id it is handed. This states that once, instead of a non-null assertion at
 * every call site in the two write modules.
 */
export function chunk<T>(value: T | undefined): T {
  return value as T
}

/**
 * Query options for the participant view: the link's code rides along as a rule param,
 * which is what the permission rules check a viewer's query against. `undefined` for a
 * leader, whose membership is the permission and who passes nothing.
 */
export function viewOptions(
  viewCode: string | undefined,
): { ruleParams: { viewCode: string } } | undefined {
  return viewCode === undefined ? undefined : { ruleParams: { viewCode } }
}
