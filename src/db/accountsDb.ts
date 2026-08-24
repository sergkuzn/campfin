/**
 * Writes for grants. Only the admin's screen calls any of these, and only the admin's
 * account row makes the server accept them — the UI hiding the screen is convenience, the
 * `accounts` rules in `instant.perms.ts` are the boundary.
 *
 * Reads live in `src/hooks/useAccount.ts` and `src/hooks/useAdmin.ts`, where a query
 * object keeps its inferred type.
 */

import { id, lookup } from '@instantdb/react'
import { normalizeEmail } from '../lib/accounts'
import type { AccountRole } from '../lib/types'
import { chunk, db } from './instant'

type GrantArgs = {
  email: string
  role: AccountRole
  campQuota: number
  now: number
}

/**
 * Activate an address. Writable before that person has ever signed in, which is the point:
 * you can hand out access from a message thread rather than waiting for them to appear.
 *
 * `lookup('email', …)` links by the unique email instead of by id, so the grant attaches to
 * whichever `$users` row carries that address — the one Instant creates at first sign-in
 * included. The email is normalised first because the link is only as good as the match.
 */
export function grantAccount(args: GrantArgs): Promise<unknown> {
  const { email, role, campQuota, now } = args
  const address = normalizeEmail(email)
  return db.transact(
    chunk(db.tx.accounts[id()])
      .update({ email: address, role, campQuota, grantedAt: now })
      .link({ user: lookup('email', address) }),
  )
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
