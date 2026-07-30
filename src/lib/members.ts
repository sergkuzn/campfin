/**
 * Who is in a camp. Pure — no React, no database. The permission rules on the server
 * decide what a member may *do*; these helpers only answer what the UI needs to draw:
 * am I an admin here, and how many of us are there?
 */

import type { MemberRole, Membership } from './types'

function isMemberRole(value: unknown): value is MemberRole {
  return value === 'admin' || value === 'editor'
}

/** The door from an untrusted row into a `Membership`. */
export function isMembership(value: unknown): value is Membership {
  if (typeof value !== 'object' || value === null) return false
  const m = value as Record<string, unknown>
  return (
    typeof m.id === 'string' &&
    typeof m.campId === 'string' &&
    typeof m.userId === 'string' &&
    typeof m.createdAt === 'number' &&
    isMemberRole(m.role)
  )
}

/** My row in this camp, or undefined — which is also what "I am not a member" looks like. */
export function myMembership(
  memberships: Membership[],
  campId: string,
  userId: string,
): Membership | undefined {
  return memberships.find((m) => m.campId === campId && m.userId === userId)
}

/**
 * Admin gates the destructive camp-level action (deleting the camp) in the UI. It is not a
 * server-side rule: a permission rule can read the camp's member ids and its member roles,
 * but cannot pair them up row by row, so every member may write. Finer roles are deferred.
 */
export function isCampAdmin(memberships: Membership[], campId: string, userId: string): boolean {
  return myMembership(memberships, campId, userId)?.role === 'admin'
}

/** How many leaders share this camp. Counts, never names. */
export function memberCount(memberships: Membership[], campId: string): number {
  return memberships.filter((m) => m.campId === campId).length
}
