/**
 * The admin's view of the whole instance: everyone who has ever signed in, every grant
 * that has been written, and every camp in the database.
 *
 * The queries here are the only ones in the app that are not scoped to one camp or one
 * user, and they only return anything because `instant.perms.ts` lets an `admin` account
 * through. For anybody else they come back empty — which is why `enabled` is a convenience
 * to save a round trip, not a guard.
 */

import { useCallback, useEffect, useMemo } from 'react'
import * as accountsDb from '../db/accountsDb'
import { db } from '../db/instant'
import { useT } from '../i18n'
import { type AccessMap, buildAccessMap } from '../lib/access'
import {
  accountForEmail,
  buildRoster,
  clampQuota,
  DEFAULT_CAMP_QUOTA,
  isEmailish,
  normalizeEmail,
  pendingLinks,
  type RosterEntry,
  type RosterUser,
  waitingForActivation,
} from '../lib/accounts'
import { mapRows, toAccount, toCamp, toMembership } from '../lib/rows'
import type { Account, Camp } from '../lib/types'
import { useWriteState } from './useWriteState'

export type UseAdmin = {
  /** Everyone the admin can act on, signed-in and merely invited alike, sorted by address. */
  roster: RosterEntry[]
  /** The subset of the roster that is a to-do: signed in, nobody has activated them. */
  waiting: RosterEntry[]
  /** Every camp in the database, however it got there. */
  camps: Camp[]
  /** Who can reach what: the memberships of every camp, joined to the roster's addresses. */
  access: AccessMap
  isLoading: boolean
  error: string | null
  /** Activate an address. Returns false — with an error on screen — if it is malformed or
   *  already granted. */
  grant: (email: string) => boolean
  setQuota: (accountId: string, quota: number) => void
  revoke: (accountId: string) => void
}

export function useAdmin(enabled: boolean): UseAdmin {
  const t = useT()

  // Passing `null` skips the query outright, so a non-admin phone never asks for the roster
  // at all. `$users` carries its nested grant, which is the link the permission rules read;
  // `accounts` is queried separately because a grant can exist with no user behind it yet.
  const {
    isLoading,
    error: queryError,
    data,
  } = db.useQuery(
    // `camps.members` rides along in the same subscription: memberships are what say who
    // can reach a camp, and they are a handful of rows per camp.
    enabled ? { $users: { account: {} }, accounts: {}, camps: { members: {} } } : null,
  )

  // A failed load outranks a stale write or validation message: with no roster on screen,
  // nothing else said about it is trustworthy either.
  const { error, run, fail } = useWriteState(queryError)

  const accounts = useMemo<Account[]>(() => mapRows(data?.accounts, toAccount), [data])
  const camps = useMemo(() => mapRows(data?.camps, toCamp), [data])

  const users = useMemo<RosterUser[]>(
    () =>
      (data?.$users ?? []).map((user) => ({
        id: user.id,
        email: user.email,
        accountId: user.account?.id ?? null,
      })),
    [data],
  )

  const roster = useMemo(() => buildRoster(users, accounts), [users, accounts])
  const waiting = useMemo(() => waitingForActivation(roster), [roster])

  const memberships = useMemo(
    () => (data?.camps ?? []).flatMap((camp) => mapRows(camp.members, toMembership)),
    [data],
  )
  const access = useMemo(
    () => buildAccessMap(camps, memberships, users),
    [camps, memberships, users],
  )

  // Finish the grants that were written to an address before that person existed. Only an
  // admin may write the `user` link, so this screen is one of the two places it can happen
  // — the other is `api/request-access.ts`, which claims a grant at first sign-in and needs
  // a host running functions. Here it costs one write per person, once, and the effect is
  // what makes it a synchronisation with the database rather than something the admin has
  // to notice and press.
  const claims = useMemo(() => pendingLinks(users, accounts), [users, accounts])
  useEffect(() => {
    for (const { accountId, userId } of claims) {
      run(accountsDb.linkAccountUser(accountId, userId))
    }
  }, [claims, run])

  const grant = useCallback(
    (email: string): boolean => {
      const address = normalizeEmail(email)
      if (!isEmailish(address)) {
        fail(t.admin.badEmail)
        return false
      }
      if (accountForEmail(accounts, address) !== undefined) {
        fail(t.admin.alreadyGranted(address))
        return false
      }
      run(
        accountsDb.grantAccount({
          email: address,
          // The roster is the whole instance's user list, so it is also the answer to
          // "has this address ever signed in?" — and a `$users` row is the only thing the
          // grant can be linked to at write time.
          userId: users.find((user) => normalizeEmail(user.email) === address)?.id ?? null,
          role: 'leader',
          campQuota: DEFAULT_CAMP_QUOTA,
          now: Date.now(),
        }),
      )
      return true
    },
    [accounts, fail, run, t, users],
  )

  const setQuota = useCallback(
    (accountId: string, quota: number): void =>
      run(accountsDb.setCampQuota(accountId, clampQuota(quota))),
    [run],
  )

  const revoke = useCallback(
    (accountId: string): void => run(accountsDb.revokeAccount(accountId)),
    [run],
  )

  return {
    roster,
    waiting,
    camps,
    access,
    isLoading,
    error,
    grant,
    setQuota,
    revoke,
  }
}
