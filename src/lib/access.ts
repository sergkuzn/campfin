/**
 * Who can reach which camp, in both directions. Pure — no React, no database.
 *
 * Memberships carry a user id and nothing else (golden rule 3), so an address only appears
 * by joining them against the roster of signed-in users. That join is admin-only in
 * practice: `$users.view` hands out other people's addresses to an admin account alone.
 *
 * One pass builds both indexes, because they are the same join read from either end — the
 * camp panel wants "who is in this camp", the people panel wants "which camps is this
 * person in", and walking the memberships twice to answer them would drift.
 */

import type { RosterUser } from './accounts'
import type { Camp, Membership } from './types'

export type CampMembers = {
  /** Addresses of everyone in the camp, alphabetical. */
  emails: string[]
  /**
   * Members whose `$users` row is missing from the roster — a deleted account, or a
   * partly-loaded query. Counted rather than dropped: on an access screen, a member you
   * cannot name is still a member, and silently omitting them would understate access.
   */
  unknownCount: number
}

export type AccessMap = {
  /** Keyed by camp id; every listed camp has an entry, even one with no members. */
  byCamp: Map<string, CampMembers>
  /** Keyed by address; only people who are in at least one camp appear. */
  byEmail: Map<string, Camp[]>
}

export function buildAccessMap(
  camps: readonly Camp[],
  memberships: readonly Membership[],
  users: readonly RosterUser[],
): AccessMap {
  const emailByUserId = new Map(users.map((user) => [user.id, user.email]))
  const campById = new Map(camps.map((camp) => [camp.id, camp]))

  const byCamp = new Map<string, CampMembers>(
    camps.map((camp) => [camp.id, { emails: [], unknownCount: 0 }]),
  )
  const byEmail = new Map<string, Camp[]>()

  for (const membership of memberships) {
    // A membership of a camp outside the list (or a camp the query didn't return) has
    // nothing to attach to on either side.
    const camp = campById.get(membership.campId)
    const entry = byCamp.get(membership.campId)
    if (camp === undefined || entry === undefined) continue

    const email = emailByUserId.get(membership.userId)
    if (email === undefined) {
      entry.unknownCount += 1
      continue
    }

    // Rejoining a camp can leave a second membership row; the same address must not be
    // listed twice. Linear scans, because a camp holds two leaders, not two thousand.
    if (!entry.emails.includes(email)) entry.emails.push(email)

    const theirCamps = byEmail.get(email)
    if (theirCamps === undefined) byEmail.set(email, [camp])
    else if (!theirCamps.some((other) => other.id === camp.id)) theirCamps.push(camp)
  }

  for (const entry of byCamp.values()) entry.emails.sort((a, b) => a.localeCompare(b))
  for (const list of byEmail.values()) list.sort((a, b) => a.name.localeCompare(b.name))

  return { byCamp, byEmail }
}
