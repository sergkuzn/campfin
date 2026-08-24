/**
 * The camps this user is a member of, as a live query, plus the writes that change them.
 *
 * Nothing here holds the list in state any more: `db.useQuery` subscribes, and a write on
 * either phone re-renders both. The query is the *authorisation boundary made visible* —
 * `where: { 'members.user.id': userId }` traverses the membership link, and the server's
 * permission rules enforce the same thing, so a camp you were never invited to is not
 * merely filtered out, it is unreadable.
 */

import { useCallback, useMemo } from 'react'
import * as campsDb from '../db/campsDb'
import { db } from '../db/instant'
import { useT } from '../i18n'
import { campNameExists } from '../lib/camps'
import { generateJoinCode } from '../lib/joinCode'
import { mapRows, toBlock, toCamp, toMembership } from '../lib/rows'
import type { Camp, Membership, PerDiemBlock } from '../lib/types'
import { useWriteState } from './useWriteState'

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
  renameCamp: (campId: string, name: string) => void
  /** Name the leader holding the camp's cash. Only ever a hand-over: a camp past setup
   *  always has a holder, because every debt in it is measured against one. */
  setMoneyHolder: (campId: string, name: string) => void
  deleteCamp: (campId: string) => void
  /** Dismiss the current error — call it when navigating away from the input that raised it. */
  clearError: () => void
}

/**
 * @param allCamps drops the membership filter, for the admin's "every camp" switch. The
 *   server still decides: `camps.view` returns the whole table to an admin account and
 *   only your own camps to anyone else, so this widens the request, never the answer.
 */
export function useCamps(userId: string, allCamps = false): UseCamps {
  const t = useT()

  // The nested `members` and `perDiemBlocks` ride along in the same subscription, so the
  // leader count, my role and every camp's date window cost no second query. Blocks are a
  // handful of rows per camp — cheap enough to carry for the list.
  const {
    isLoading,
    error: queryError,
    data,
  } = db.useQuery({
    camps: {
      // The switch varies the *value*, not the shape of the clause: Instant's result type
      // is inferred from the query object, and a ternary over whole `where` objects (or an
      // `or` of two) makes it a union it collapses to `never`. So "every camp" is spelled
      // as "every camp with a member", which every camp this app creates has — its author's
      // membership is written in the same transaction.
      $: { where: { 'members.user.id': allCamps ? { $isNull: false } : userId } },
      members: {},
      perDiemBlocks: {},
    },
  })

  // Validation failures and rejected writes share one channel: both are a UI concern, and
  // a failed load outranks either.
  const { error, run, fail, clearError } = useWriteState(queryError)

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
        fail(t.camps.nameTaken(trimmed))
        return null
      }

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
      // A refused creation reads differently from a refused edit: it is usually the camp
      // quota, not a lost connection. The screen gets that plain sentence; the console gets
      // the server's own reason, which names the namespace and rule that refused — the
      // difference between "a permission said no" and knowing which one.
      clearError()
      void done.catch((cause: unknown) => {
        console.error('Camp creation was refused', cause)
        fail(t.sync.createFailed)
      })
      return camp
    },
    [camps, clearError, fail, t, userId],
  )

  const renameCamp = useCallback(
    (campId: string, name: string): void => {
      const trimmed = name.trim()
      if (campNameExists(camps, trimmed, campId)) {
        fail(t.camps.nameTaken(trimmed))
        return
      }
      run(campsDb.renameCamp(campId, trimmed))
    },
    [camps, fail, run, t],
  )

  const setMoneyHolder = useCallback(
    (campId: string, name: string): void => {
      // The screens already refuse an empty field; dropping a blank here as well keeps a
      // person called "" out of the camp whatever calls this.
      const trimmed = name.trim()
      if (trimmed === '') return
      run(campsDb.setMoneyHolder(campId, trimmed))
    },
    [run],
  )

  const deleteCamp = useCallback((campId: string): void => run(campsDb.deleteCamp(campId)), [run])

  return {
    camps,
    memberships,
    blocks,
    isLoading,
    error,
    createCamp,
    renameCamp,
    setMoneyHolder,
    deleteCamp,
    clearError,
  }
}
