/**
 * The admin's view of the whole instance: everyone who has ever signed in, every grant
 * that has been written, and every camp in the database.
 *
 * The queries here are the only ones in the app that are not scoped to one camp or one
 * user, and they only return anything because `instant.perms.ts` lets an `admin` account
 * through. For anybody else they come back empty — which is why `enabled` is a convenience
 * to save a round trip, not a guard.
 */

import { useCallback, useMemo, useState } from 'react'
import * as accountsDb from '../db/accountsDb'
import { db } from '../db/instant'
import { useT } from '../i18n'
import {
  accountForEmail,
  buildRoster,
  clampQuota,
  DEFAULT_CAMP_QUOTA,
  isEmailish,
  normalizeEmail,
  type RosterEntry,
  type RosterUser,
} from '../lib/accounts'
import { mapRows, toAccount, toCamp } from '../lib/rows'
import type { Account, Camp } from '../lib/types'

export type UseAdmin = {
  /** Everyone the admin can act on, signed-in and merely invited alike, sorted by address. */
  roster: RosterEntry[]
  /** Every camp in the database, however it got there. */
  camps: Camp[]
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
  const [error, setError] = useState<string | null>(null)

  // Passing `null` skips the query outright, so a non-admin phone never asks for the roster
  // at all. `$users` carries its nested grant, which is the link the permission rules read;
  // `accounts` is queried separately because a grant can exist with no user behind it yet.
  const {
    isLoading,
    error: queryError,
    data,
  } = db.useQuery(enabled ? { $users: { account: {} }, accounts: {}, camps: {} } : null)

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

  const grant = useCallback(
    (email: string): boolean => {
      const address = normalizeEmail(email)
      if (!isEmailish(address)) {
        setError(t.admin.badEmail)
        return false
      }
      if (accountForEmail(accounts, address) !== undefined) {
        setError(t.admin.alreadyGranted(address))
        return false
      }
      setError(null)
      void accountsDb
        .grantAccount({
          email: address,
          role: 'leader',
          campQuota: DEFAULT_CAMP_QUOTA,
          now: Date.now(),
        })
        .catch(() => setError(t.sync.writeFailed))
      return true
    },
    [accounts, t],
  )

  const setQuota = useCallback(
    (accountId: string, quota: number): void => {
      setError(null)
      void accountsDb
        .setCampQuota(accountId, clampQuota(quota))
        .catch(() => setError(t.sync.writeFailed))
    },
    [t],
  )

  const revoke = useCallback(
    (accountId: string): void => {
      setError(null)
      void accountsDb.revokeAccount(accountId).catch(() => setError(t.sync.writeFailed))
    },
    [t],
  )

  return {
    roster,
    camps,
    isLoading,
    // A failed load outranks a stale write message: with no roster on screen, nothing else
    // said about it is trustworthy either.
    error: queryError === undefined ? error : t.sync.loadFailed(queryError.message),
    grant,
    setQuota,
    revoke,
  }
}
