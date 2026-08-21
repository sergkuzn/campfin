/**
 * The camps this user is a member of, as a live query, plus the writes that change them.
 *
 * Nothing here holds the list in state any more: `db.useQuery` subscribes, and a write on
 * either phone re-renders both. The query is the *authorisation boundary made visible* —
 * `where: { 'members.user.id': userId }` traverses the membership link, and the server's
 * permission rules enforce the same thing, so a camp you were never invited to is not
 * merely filtered out, it is unreadable.
 */

import { useCallback, useMemo, useState } from 'react'
import * as campsDb from '../db/campsDb'
import { db } from '../db/instant'
import { useT } from '../i18n'
import { campNameExists, uniqueCampName } from '../lib/camps'
import { parseCampExport } from '../lib/importJson'
import { generateJoinCode } from '../lib/joinCode'
import { mapRows, toBlock, toCamp, toMembership } from '../lib/rows'
import type { Camp, Membership, PerDiemBlock } from '../lib/types'

export type UseCamps = {
  camps: Camp[]
  /** Memberships of every visible camp — enough to count leaders and to know my own role. */
  memberships: Membership[]
  /** Per-diem blocks of every visible camp. They are what date a camp, so the list needs
   *  them to say whether one is upcoming, running or finished. */
  blocks: PerDiemBlock[]
  isLoading: boolean
  /** A rejected write, a rejected name, or a failed load; null when all is well. */
  error: string | null
  /** Returns the created camp so the caller can navigate straight into it, or null if the name is taken. */
  createCamp: (name: string) => Camp | null
  /** Restores an exported dump as a new camp. Null when the file was not readable — the
   *  reason lands in `error`. */
  importCamp: (text: string) => Camp | null
  renameCamp: (campId: string, name: string) => void
  /** Name the leader holding the camp's cash, or null so nobody does. */
  setMoneyHolder: (campId: string, name: string | null) => void
  deleteCamp: (campId: string) => void
  /** Dismiss the current error — call it when navigating away from the input that raised it. */
  clearError: () => void
}

export function useCamps(userId: string): UseCamps {
  const t = useT()
  // Validation failures and rejected writes are a UI concern, not query state.
  const [error, setError] = useState<string | null>(null)

  // The nested `members` and `perDiemBlocks` ride along in the same subscription, so the
  // leader count, my role and every camp's date window cost no second query. Blocks are a
  // handful of rows per camp — cheap enough to carry for the list.
  const {
    isLoading,
    error: queryError,
    data,
  } = db.useQuery({
    camps: { $: { where: { 'members.user.id': userId } }, members: {}, perDiemBlocks: {} },
  })

  const camps = useMemo(() => mapRows(data?.camps, toCamp), [data])
  const memberships = useMemo(
    () => (data?.camps ?? []).flatMap((camp) => mapRows(camp.members, toMembership)),
    [data],
  )
  const blocks = useMemo(
    () => (data?.camps ?? []).flatMap((camp) => mapRows(camp.perDiemBlocks, toBlock)),
    [data],
  )

  // useCallback keeps these identities stable across renders, so children taking them as
  // props don't re-render for nothing. `camps` is a dependency because the name check
  // reads it.
  const createCamp = useCallback(
    (name: string): Camp | null => {
      const trimmed = name.trim()
      if (campNameExists(camps, trimmed)) {
        setError(t.camps.nameTaken(trimmed))
        return null
      }
      setError(null)

      // The write lands locally at once, so the camp can be returned and opened before the
      // server has heard of it. Only a *rejection* — a join-code collision, a permission
      // rule — needs reporting, and then Instant rolls the optimistic rows back.
      const { camp, done } = campsDb.createCamp({
        name: trimmed,
        joinCode: generateJoinCode(trimmed),
        userId,
        now: Date.now(),
        everydayPoolName: t.pools.everydayDefault,
      })
      void done.catch(() => setError(t.sync.createFailed))
      return camp
    },
    [camps, t, userId],
  )

  const importCamp = useCallback(
    (text: string): Camp | null => {
      const result = parseCampExport(text)
      // The union means the failure branch has an `issue` and no dump, so there is no way
      // to import a file that was never parsed.
      if (!result.ok) {
        setError(t.camps.importFailed[result.issue])
        return null
      }
      setError(null)

      // Restoring a dump next to the camp it came from is the normal case — a suffix beats
      // refusing the file, and the name is editable afterwards anyway.
      const name = uniqueCampName(camps, result.dump.camp.name)
      const { camp, done } = campsDb.importCamp({
        parsed: result.dump,
        name,
        // A fresh code: the old camp, if it still exists, keeps its own.
        joinCode: generateJoinCode(name),
        userId,
        now: Date.now(),
      })
      void done.catch(() => setError(t.sync.createFailed))
      return camp
    },
    [camps, t, userId],
  )

  const renameCamp = useCallback(
    (campId: string, name: string): void => {
      const trimmed = name.trim()
      if (campNameExists(camps, trimmed, campId)) {
        setError(t.camps.nameTaken(trimmed))
        return
      }
      setError(null)
      void campsDb.renameCamp(campId, trimmed).catch(() => setError(t.sync.writeFailed))
    },
    [camps, t],
  )

  const setMoneyHolder = useCallback(
    (campId: string, name: string | null): void => {
      setError(null)
      // A blank name means nobody holds the money, which is a real state — not an error to
      // report and not a person called "".
      const trimmed = name === null ? null : name.trim()
      void campsDb
        .setMoneyHolder(campId, trimmed === '' ? null : trimmed)
        .catch(() => setError(t.sync.writeFailed))
    },
    [t],
  )

  const deleteCamp = useCallback(
    (campId: string): void => {
      void campsDb.deleteCamp(campId).catch(() => setError(t.sync.writeFailed))
    },
    [t],
  )

  const clearError = useCallback((): void => {
    setError(null)
  }, [])

  return {
    camps,
    memberships,
    blocks,
    isLoading,
    // A failed load outranks a stale validation message: if the data isn't there, nothing
    // else on screen is trustworthy either.
    error: queryError === undefined ? error : t.sync.loadFailed(queryError.message),
    createCamp,
    importCamp,
    renameCamp,
    setMoneyHolder,
    deleteCamp,
    clearError,
  }
}
