/**
 * Who may use the app, and how much. Pure — no React, no database.
 *
 * The server decides this too, in `instant.perms.ts`, and it is the server's answer that
 * counts: everything here exists so a screen can say "2 of 3 camps left" instead of
 * offering a button whose write will simply be refused.
 */

import type { Account, AccountRole } from './types'

/**
 * What a newly granted leader starts with. Two is the shape of the real job — this year's
 * camp and next year's, being planned side by side — and the admin raises it per person.
 */
export const DEFAULT_CAMP_QUOTA = 1

/** Nobody is granted a negative quota, and no stepper goes past this. */
export const MAX_CAMP_QUOTA = 20

function isAccountRole(value: unknown): value is AccountRole {
  return value === 'admin' || value === 'leader'
}

/** The door from an untrusted row into an `Account`. */
export function isAccount(value: unknown): value is Account {
  if (typeof value !== 'object' || value === null) return false
  const a = value as Record<string, unknown>
  return (
    typeof a.id === 'string' &&
    typeof a.email === 'string' &&
    typeof a.campQuota === 'number' &&
    typeof a.grantedAt === 'number' &&
    isAccountRole(a.role)
  )
}

/**
 * The comparable form of an address. Emails are case-insensitive in practice and arrive
 * with whatever whitespace a paste brought along, so one address typed two ways must not
 * become two grants — the stored value is the normalised one, and `email` is unique.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

/**
 * Enough of an address to be worth writing down. Deliberately loose: the real check is
 * whether a code arrives in that inbox, and a stricter pattern only ever rejects addresses
 * that turn out to be valid.
 */
export function isEmailish(raw: string): boolean {
  const value = normalizeEmail(raw)
  const at = value.indexOf('@')
  return at > 0 && at === value.lastIndexOf('@') && at < value.length - 1 && !/\s/.test(value)
}

/**
 * How many more camps this account may create.
 *
 * `null` means "no limit" rather than "none left" — the admin is never metered — so callers
 * have to say which one they mean instead of a 0 quietly standing for both.
 */
export function campsLeft(account: Account | null, created: number): number | null {
  if (account === null) return 0
  if (account.role === 'admin') return null
  return Math.max(0, account.campQuota - created)
}

export function canCreateCamp(account: Account | null, created: number): boolean {
  const left = campsLeft(account, created)
  return left === null || left > 0
}

export function isAdminAccount(account: Account | null): boolean {
  return account?.role === 'admin'
}

/** Keeps a typed or stepped quota inside what the schema and the UI both expect. */
export function clampQuota(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(MAX_CAMP_QUOTA, Math.max(0, Math.round(value)))
}

/** A person as the admin screen lists them, wherever the app first heard of them. */
export type RosterEntry = {
  /**
   * Their sign-in identity, or `null` for a grant written to an address that has never
   * been used to sign in. Both are real states worth showing: one is somebody using the
   * app, the other is an invitation still in the post.
   */
  userId: string | null
  email: string
  /** `null` for a signed-in account nobody has activated yet. */
  account: Account | null
}

/** A signed-in user as the admin query sees them, before the two lists are joined. */
export type RosterUser = {
  id: string
  email: string
  /** The grant linked to them, if any — the link is what the permission rules read. */
  accountId: string | null
}

/**
 * Every person the admin can act on, from the two lists that know about people: the users
 * who have signed in, and the grants that have been written.
 *
 * The two overlap but neither contains the other — a stranger signs in with no grant, and
 * a grant can be written to an address that never signs in — so this is an outer join
 * rather than a lookup, keyed on the account link and falling back to the address.
 */
export function buildRoster(
  users: readonly RosterUser[],
  accounts: readonly Account[],
): RosterEntry[] {
  const byId = new Map(accounts.map((account) => [account.id, account]))
  const claimed = new Set<string>()

  const signedIn: RosterEntry[] = users.map((user) => {
    const account = user.accountId === null ? null : (byId.get(user.accountId) ?? null)
    if (account !== null) claimed.add(account.id)
    return { userId: user.id, email: user.email, account }
  })

  // A grant nobody has signed in against yet. Matching on the *link* rather than on the
  // address is what keeps a granted-then-signed-in person off this list even if the two
  // addresses differ in case.
  const pending: RosterEntry[] = accounts
    .filter((account) => !claimed.has(account.id))
    .map((account) => ({ userId: null, email: account.email, account }))

  return [...signedIn, ...pending].sort((a, b) => a.email.localeCompare(b.email))
}

/**
 * The people waiting on the admin: signed in, no grant.
 *
 * The roster holds two different absences and only one of them is a to-do. A grant written
 * to an address that has never signed in is waiting on *that person*; somebody who signed
 * in with no grant is waiting on you. This is the second kind, and it is what the badge
 * counts and the notification announces.
 */
export function waitingForActivation(roster: readonly RosterEntry[]): RosterEntry[] {
  return roster.filter((entry) => entry.userId !== null && entry.account === null)
}

/** Is there already a grant for this address? Guards the grant-by-email field. */
export function accountForEmail(accounts: readonly Account[], email: string): Account | undefined {
  const wanted = normalizeEmail(email)
  return accounts.find((account) => normalizeEmail(account.email) === wanted)
}
