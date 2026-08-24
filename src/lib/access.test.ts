import { describe, expect, it } from 'vitest'
import { buildAccessMap } from './access'
import type { RosterUser } from './accounts'
import type { Camp, Membership } from './types'

function camp(id: string, name: string): Camp {
  return { id, name, joinCode: id.toUpperCase(), createdAt: 1 }
}

function membership(campId: string, userId: string): Membership {
  return { id: `${campId}-${userId}`, campId, userId, role: 'editor', createdAt: 1 }
}

function user(id: string, email: string): RosterUser {
  return { id, email, accountId: null }
}

const camps = [camp('c1', 'Summer'), camp('c2', 'Autumn')]
const users = [user('u1', 'ann@example.com'), user('u2', 'bo@example.com')]

describe('buildAccessMap', () => {
  it('lists a camp of its members, alphabetically', () => {
    const { byCamp } = buildAccessMap(
      camps,
      [membership('c1', 'u2'), membership('c1', 'u1')],
      users,
    )
    expect(byCamp.get('c1')).toEqual({
      emails: ['ann@example.com', 'bo@example.com'],
      unknownCount: 0,
    })
  })

  it('gives a camp with no members an empty entry rather than none', () => {
    const { byCamp } = buildAccessMap(camps, [membership('c1', 'u1')], users)
    expect(byCamp.get('c2')).toEqual({ emails: [], unknownCount: 0 })
  })

  it('lists a person of their camps, by name', () => {
    const { byEmail } = buildAccessMap(
      camps,
      [membership('c1', 'u1'), membership('c2', 'u1')],
      users,
    )
    expect(byEmail.get('ann@example.com')?.map((c) => c.name)).toEqual(['Autumn', 'Summer'])
    // Someone in no camp is absent, not an empty list.
    expect(byEmail.has('bo@example.com')).toBe(false)
  })

  it('counts a member whose user row is missing instead of dropping them', () => {
    const { byCamp, byEmail } = buildAccessMap(camps, [membership('c1', 'gone')], users)
    expect(byCamp.get('c1')).toEqual({ emails: [], unknownCount: 1 })
    expect(byEmail.size).toBe(0)
  })

  it('counts a rejoined member once on both sides', () => {
    const duplicate = { ...membership('c1', 'u1'), id: 'again' }
    const { byCamp, byEmail } = buildAccessMap(camps, [membership('c1', 'u1'), duplicate], users)
    expect(byCamp.get('c1')?.emails).toEqual(['ann@example.com'])
    expect(byEmail.get('ann@example.com')).toHaveLength(1)
  })

  it('ignores a membership of a camp that is not listed', () => {
    const { byCamp, byEmail } = buildAccessMap(camps, [membership('gone', 'u1')], users)
    expect(byCamp.get('c1')).toEqual({ emails: [], unknownCount: 0 })
    expect(byEmail.size).toBe(0)
  })
})
