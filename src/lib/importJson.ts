/**
 * The other half of the escape hatch: an exported dump read back in. Whatever is in that
 * file — an old version, a truncated download, something else entirely — has to become
 * either a camp's worth of valid rows or a named reason why not.
 *
 * Pure, and it deliberately re-uses `rows.ts`: an imported file is untrusted for exactly
 * the same reasons a query result is, so one set of mappers guards both.
 *
 * Importing never merges. It builds a *new* camp with fresh ids, so a dump can be restored
 * next to the camp it came from without the two writing over each other.
 */

import { mapRows, toBlock, toCamp, toExpense, toMovement, toPool, toSource } from './rows'
import type { Camp, Expense, IncomeSource, Movement, PerDiemBlock, Pool } from './types'

/** The dump version this build writes and the newest it can read. */
const CURRENT_VERSION = 5

/** Why a file was refused. Codes, not sentences — the dictionary phrases them. */
export type ImportIssue =
  /** Not JSON at all. */
  | 'json'
  /** JSON, but not a campfin dump — no marker, or no readable camp inside. */
  | 'format'
  /** A campfin dump written by a newer build, whose rows this one may not understand. */
  | 'version'

/** One camp's rows, exactly what `buildCampExport` writes and `importCamp` needs. */
export type CampDump = {
  camp: Camp
  pools: Pool[]
  sources: IncomeSource[]
  blocks: PerDiemBlock[]
  expenses: Expense[]
  movements: Movement[]
}

/**
 * Success or a reason, as a discriminated union rather than `CampDump | null`: checking
 * `result.ok` narrows the type, so the caller cannot reach for `dump` on a failure or
 * forget to show the reason. It is the same shape the standard library uses for parsing.
 */
export type ImportResult = { ok: true; dump: CampDump } | { ok: false; issue: ImportIssue }

export function parseCampExport(text: string): ImportResult {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return { ok: false, issue: 'json' }
  }

  if (typeof value !== 'object' || value === null) return { ok: false, issue: 'format' }
  const dump = value as Record<string, unknown>

  // The marker is what separates "an old campfin dump" from "somebody's other JSON file",
  // and it is worth saying so before blaming the version.
  if (dump.format !== 'campfin.camp') return { ok: false, issue: 'format' }
  if (typeof dump.version !== 'number') return { ok: false, issue: 'format' }
  // Older dumps are readable — v3 has no expenses, v4 no movements, and a missing array
  // simply reads as none. Camp `startDate`/`endDate` from an older dump are dropped by
  // `toCamp`: the window comes from the blocks now, and those travel in the dump too, so
  // nothing is lost. A *newer* dump is not readable: its rows may carry meaning this
  // build would silently drop.
  if (dump.version > CURRENT_VERSION) return { ok: false, issue: 'version' }

  const camp = toCamp(dump.camp)
  if (camp === null) return { ok: false, issue: 'format' }

  return {
    ok: true,
    dump: {
      camp,
      // Rows that fail their guard are skipped, not thrown on: one corrupted receipt must
      // not cost the user the other four hundred.
      pools: mapRows(asArray(dump.pools), toPool),
      sources: mapRows(asArray(dump.sources), toSource),
      blocks: mapRows(asArray(dump.blocks), toBlock),
      expenses: mapRows(asArray(dump.expenses), toExpense),
      movements: mapRows(asArray(dump.movements), toMovement),
    },
  }
}

function asArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined
}

export type RemapOptions = {
  /** The new camp's id, minted by the caller — `src/lib/` does not generate ids. */
  campId: string
  joinCode: string
  name: string
  /** A fresh id per row. In tests this is a counter, in the app it is Instant's `id()`. */
  newId: () => string
}

/**
 * The dump with every id replaced and every reference re-pointed at its new row.
 *
 * A row whose target is missing — a receipt from a pool that failed its guard, a block
 * whose source is gone — is dropped rather than written with a dangling id. It would show
 * up nowhere and silently unbalance the settlement.
 */
export function remapCampExport(dump: CampDump, options: RemapOptions): CampDump {
  const { campId, joinCode, name, newId } = options

  // Map from old id to new, built once per namespace and read while remapping the rows
  // that point at it. A Map (not an object) because ids are arbitrary strings and `Map`
  // has no inherited keys to collide with.
  const poolIds = new Map(dump.pools.map((pool) => [pool.id, newId()]))
  // Only sources that survive get an entry, so a block whose source was dropped cannot
  // find a new id and is dropped in turn — the cascade has to reach all the way down.
  const sourceIds = new Map(
    dump.sources
      .filter((source) => poolIds.has(source.poolId))
      .map((source) => [source.id, newId()]),
  )

  return {
    camp: { ...dump.camp, id: campId, name, joinCode },

    pools: dump.pools.flatMap((pool) => {
      const id = poolIds.get(pool.id)
      return id === undefined ? [] : [{ ...pool, id, campId }]
    }),

    sources: dump.sources.flatMap((source) => {
      const id = sourceIds.get(source.id)
      const poolId = poolIds.get(source.poolId)
      if (id === undefined || poolId === undefined) return []
      return [{ ...source, id, campId, poolId }]
    }),

    blocks: dump.blocks.flatMap((block) => {
      const sourceId = sourceIds.get(block.sourceId)
      if (sourceId === undefined) return []
      return [{ ...block, id: newId(), campId, sourceId }]
    }),

    expenses: dump.expenses.flatMap((expense) => {
      const poolId = poolIds.get(expense.poolId)
      if (poolId === undefined) return []
      return [{ ...expense, id: newId(), campId, poolId }]
    }),

    // The return type is written out because `flatMap` over a union would otherwise infer
    // "array of deposits *or* array of volunteers" rather than one array of either.
    movements: dump.movements.flatMap((movement): Movement[] => {
      if (movement.kind === 'volunteer_in') return [{ ...movement, id: newId(), campId }]
      const poolId = poolIds.get(movement.poolId)
      if (poolId === undefined) return []
      return [{ ...movement, id: newId(), campId, poolId }]
    }),
  }
}
