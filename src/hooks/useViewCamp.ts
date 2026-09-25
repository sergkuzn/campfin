/**
 * The camp behind a participant view link, looked up by the link's code.
 *
 * The viewer is not signed in and belongs to no camp, so the ordinary camps query would
 * return nothing. This one names the code both in its `where` and as a rule param: the
 * `where` picks the camp, the rule param is what the server's `camps.view` rule accepts.
 * An expired link and a wrong one look the same from here — the server returns no row for
 * either — which is why there is one "not found" state rather than two.
 */

import { useMemo } from 'react'
import { db, viewOptions } from '../db/instant'
import { mapRows, toCamp } from '../lib/rows'
import type { Camp } from '../lib/types'

export type ViewCampState =
  | { status: 'loading' }
  | { status: 'notFound' }
  | { status: 'error'; message: string }
  | { status: 'found'; camp: Camp }

export function useViewCamp(viewCode: string): ViewCampState {
  const { isLoading, error, data } = db.useQuery(
    { camps: { $: { where: { viewCode } } } },
    viewOptions(viewCode),
  )

  const camp = useMemo(() => mapRows(data?.camps, toCamp)[0] ?? null, [data])

  if (isLoading) return { status: 'loading' }
  if (error !== undefined) return { status: 'error', message: error.message }
  return camp === null ? { status: 'notFound' } : { status: 'found', camp }
}
