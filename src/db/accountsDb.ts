/**
 * Writes for grants. Only the admin's screen calls any of these, and only the admin's
 * account row makes the server accept them — the UI hiding the screen is convenience, the
 * `accounts` rules in `instant.perms.ts` are the boundary.
 *
 * Reads live in `src/hooks/useAccount.ts` and `src/hooks/useAdmin.ts`, where a query
 * object keeps its inferred type.
 */

import { id } from '@instantdb/react'
import { normalizeEmail } from '../lib/accounts'
import type { AccountRole } from '../lib/types'
import { chunk, db } from './instant'

type GrantArgs = {
  email: string
  /** Their `$users` row, or `null` for an address that has never signed in. */
  userId: string | null
  role: AccountRole
  campQuota: number
  now: number
}

/**
 * Activate an address. Writable before that person has ever signed in, which is the point:
 * you can hand out access from a message thread rather than waiting for them to appear.
 *
 * The link is written only when there is a row to link to. `lookup('email', …)` cannot
 * stand in for one: it resolves an existing row and fails the whole transaction when none
 * exists, and no client may create a `$users` row — signing in is what does that. So a
 * grant to a stranger is stored unlinked, carrying the normalised address as its only clue
 * to whose it is, and `linkAccountUser` joins the two once that person appears.
 */
export function grantAccount(args: GrantArgs): Promise<unknown> {
  const { email, userId, role, campQuota, now } = args
  const row = chunk(db.tx.accounts[id()]).update({
    email: normalizeEmail(email),
    role,
    campQuota,
    grantedAt: now,
  })
  return db.transact(userId === null ? row : row.link({ user: userId }))
}

/**
 * Join a grant to the person it was written for, once they have signed in.
 *
 * Nothing but this link activates anybody: the permission rules ask
 * `auth.ref('$user.account.id')`, so a grant that merely stores the right address is inert.
 * Only an admin may write it — `accounts.update` says so — which is why the claim happens
 * on the admin's screen and in `api/request-access.ts`, never in the account's own session.
 */
export function linkAccountUser(accountId: string, userId: string): Promise<unknown> {
  return db.transact(chunk(db.tx.accounts[accountId]).link({ user: userId }))
}

/** Raise or lower how many camps someone may start. Never touches the camps they have. */
export function setCampQuota(accountId: string, campQuota: number): Promise<unknown> {
  return db.transact(chunk(db.tx.accounts[accountId]).update({ campQuota }))
}

/**
 * Take the grant away. Their camps, memberships and money stay exactly where they are —
 * this only closes the door on starting new ones, which is the one thing a grant opened.
 */
export function revokeAccount(accountId: string): Promise<unknown> {
  return db.transact(chunk(db.tx.accounts[accountId]).delete())
}
