/**
 * What the signed-in user may do across the app: start camps, and how many more.
 *
 * Every answer here is a *copy* of one the server already enforces in `instant.perms.ts`.
 * Nothing is protected by this hook — its job is to let a screen say "you have one camp
 * left" rather than offer a button whose write comes back refused.
 */

import { useMemo } from 'react'
import { db } from '../db/instant'
import { useT } from '../i18n'
import { campsLeft, canCreateCamp, isAdminAccount } from '../lib/accounts'
import { mapRows, toAccount } from '../lib/rows'
import type { Account } from '../lib/types'

/**
 * The bundle screens take as one prop instead of four booleans that could disagree —
 * "not activated", "at the limit" and "unlimited" are three different sentences, and this
 * is where they are decided once.
 */
export type CampAccess = {
  /** `null` = signed in, but nobody has activated this account. */
  account: Account | null
  isAdmin: boolean
  /** Camps this user has started — what the quota is measured against. */
  campsCreated: number
  /** How many more they may start. `null` means unlimited, never "none". */
  campsLeft: number | null
  canCreateCamp: boolean
}

export type UseAccount = {
  access: CampAccess
  isLoading: boolean
  error: string | null
}

export function useAccount(userId: string): UseAccount {
  const t = useT()

  // Two subscriptions in one query. The camps half deliberately filters on the `creator`
  // link rather than on membership: a camp you were invited to is not one you started, so
  // being a good co-leader never uses up your own allowance.
  const { isLoading, error, data } = db.useQuery({
    accounts: { $: { where: { 'user.id': userId } } },
    camps: { $: { where: { 'creator.id': userId }, fields: ['id'] } },
  })

  const account = useMemo(() => mapRows(data?.accounts, toAccount)[0] ?? null, [data])
  const campsCreated = data?.camps.length ?? 0

  const access = useMemo<CampAccess>(
    () => ({
      account,
      isAdmin: isAdminAccount(account),
      campsCreated,
      campsLeft: campsLeft(account, campsCreated),
      canCreateCamp: canCreateCamp(account, campsCreated),
    }),
    [account, campsCreated],
  )

  return {
    access,
    isLoading,
    error: error === undefined ? null : t.sync.loadFailed(error.message),
  }
}
