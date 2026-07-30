import { describe, expect, it } from 'vitest'
import { isCampAdmin, isMembership, memberCount, myMembership } from './members'
import type { Membership } from './types'

const membership = (over: Partial<Membership> = {}): Membership => ({
  id: 'm1',
  campId: 'C',
  userId: 'u1',
  role: 'admin',
  createdAt: 1,
  ...over,
})

const mine = membership()
const theirs = membership({ id: 'm2', userId: 'u2', role: 'editor' })
const elsewhere = membership({ id: 'm3', campId: 'OTHER', userId: 'u3', role: 'admin' })

describe('isMembership', () => {
  it('accepts an admin row', () => {
    expect(isMembership(mine)).toBe(true)
  })

  it('accepts an editor row', () => {
    expect(isMembership(theirs)).toBe(true)
  })

  it('rejects an unknown role', () => {
    expect(isMembership({ ...mine, role: 'treasurer' })).toBe(false)
  })

  it('rejects a row without a userId', () => {
    expect(isMembership({ id: 'm', campId: 'C', role: 'admin', createdAt: 1 })).toBe(false)
  })

  it('rejects null and non-objects', () => {
    expect(isMembership(null)).toBe(false)
    expect(isMembership('admin')).toBe(false)
  })
})

describe('myMembership', () => {
  it('finds my membership in a camp', () => {
    expect(myMembership([theirs, mine], 'C', 'u1')?.id).toBe('m1')
  })

  it('returns undefined when I am not a member', () => {
    expect(myMembership([theirs], 'C', 'u1')).toBeUndefined()
  })

  it('does not match my membership in a different camp', () => {
    expect(myMembership([elsewhere], 'C', 'u3')).toBeUndefined()
  })
})

describe('isCampAdmin', () => {
  it('is true for the camp creator', () => {
    expect(isCampAdmin([mine, theirs], 'C', 'u1')).toBe(true)
  })

  it('is false for an editor', () => {
    expect(isCampAdmin([mine, theirs], 'C', 'u2')).toBe(false)
  })

  it('is false without a membership', () => {
    expect(isCampAdmin([mine, theirs], 'C', 'u9')).toBe(false)
  })
})

describe('memberCount', () => {
  it('counts one camp’s members only', () => {
    expect(memberCount([mine, theirs, elsewhere], 'C')).toBe(2)
  })

  it('is 0 for a camp with no rows yet', () => {
    expect(memberCount([], 'C')).toBe(0)
  })
})
