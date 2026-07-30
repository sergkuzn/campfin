/**
 * Joining a camp by its code.
 *
 * The interesting part is that a joiner is *not* a member yet, so the ordinary camps query
 * cannot see the camp. The lookup therefore passes the typed code as a **rule param**, and
 * the server's `camps.view` rule accepts a caller who can name the code. Knowing the code
 * is the invitation — which is why it is checked on the server and not here.
 *
 * The query runs as soon as the code is complete, so the camp's name appears under the input
 * before the user commits. No effect, no debounce, no second piece of state: the code *is*
 * the query.
 */

import { useCallback, useMemo, useState } from 'react'
import * as campsDb from '../db/campsDb'
import { db } from '../db/instant'
import { mapRows, toCamp } from '../db/rows'
import { useT } from '../i18n'
import { normalizeJoinCode, PREFIX_LENGTH, SUFFIX_LENGTH } from '../lib/joinCode'
import type { Camp } from '../lib/types'

/** `idle` = nothing to look up yet; the rest describe a complete code. */
export type JoinStatus = 'idle' | 'searching' | 'found' | 'notFound' | 'alreadyMember'

export type UseJoinCamp = {
  /** The canonical code, as it should be displayed: "MOOR-7F3K". */
  code: string
  setCode: (raw: string) => void
  status: JoinStatus
  found: Camp | null
  error: string | null
  join: () => void
}

const CODE_LENGTH = PREFIX_LENGTH + 1 + SUFFIX_LENGTH // the +1 is the dash

export function useJoinCamp(userId: string, myCampIds: string[]): UseJoinCamp {
  const t = useT()
  const [code, setCodeState] = useState('')
  const [error, setError] = useState<string | null>(null)

  const complete = code.length === CODE_LENGTH
  const { isLoading, data } = db.useQuery(
    complete ? { camps: { $: { where: { joinCode: code } } } } : null,
    // Only meaningful alongside the query above; the rule reads it as "the code I was given".
    complete ? { ruleParams: { joinCode: code } } : undefined,
  )

  const found = useMemo(() => mapRows(data?.camps, toCamp)[0] ?? null, [data])

  const status: JoinStatus = !complete
    ? 'idle'
    : isLoading
      ? 'searching'
      : found === null
        ? 'notFound'
        : myCampIds.includes(found.id)
          ? 'alreadyMember'
          : 'found'

  const setCode = useCallback((raw: string): void => {
    // Normalising on the way in means the input shows the canonical form as it is typed,
    // and lowercase or space-separated codes from a chat message just work.
    setCodeState(normalizeJoinCode(raw))
    setError(null)
  }, [])

  const join = useCallback((): void => {
    if (found === null) return
    void campsDb
      .joinCamp({ campId: found.id, joinCode: found.joinCode, userId, now: Date.now() })
      // Clearing the field on success: the camp appears in the list on its own, because the
      // camps query is subscribed to the very membership this just created.
      .then(() => setCodeState(''))
      .catch(() => setError(t.join.failed))
  }, [found, userId, t])

  return { code, setCode, status, found, error, join }
}
