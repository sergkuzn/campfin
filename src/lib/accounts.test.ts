import { describe, expect, it } from 'vitest'
import {
  accountForEmail,
  buildRoster,
  campsLeft,
  canCreateCamp,
  clampQuota,
  isAccount,
  isAdminAccount,
  isEmailish,
  MAX_CAMP_QUOTA,
  normalizeEmail,
  type RosterUser,
  waitingForActivation,
} from './accounts'
import type { Account } from './types'

function account(over: Partial<Account> = {}): Account {
  return {
    id: 'a1',
    email: 'leader@example.com',
    role: 'leader',
    campQuota: 2,
    grantedAt: 1,
    ...over,
  }
}

describe('campsLeft', () => {
  it('counts down from the quota', () => {
    expect(campsLeft(account({ campQuota: 3 }), 0)).toBe(3)
    expect(campsLeft(account({ campQuota: 3 }), 1)).toBe(2)
  })

  it('is 0 exactly at the quota, and stays 0 past it', () => {
    expect(campsLeft(account({ campQuota: 2 }), 2)).toBe(0)
    // Reachable if the admin lowers a quota below what someone already has.
    expect(campsLeft(account({ campQuota: 2 }), 5)).toBe(0)
  })

  it('is null — unlimited, not zero — for the admin', () => {
    expect(campsLeft(account({ role: 'admin', campQuota: 0 }), 99)).toBeNull()
  })

  it('is 0 with no grant at all', () => {
    expect(campsLeft(null, 0)).toBe(0)
  })

  it('is 0 for a grant of zero camps', () => {
    expect(campsLeft(account({ campQuota: 0 }), 0)).toBe(0)
  })
})

describe('canCreateCamp', () => {
  it('separates "unlimited" from "used up"', () => {
    expect(canCreateCamp(account({ role: 'admin', campQuota: 0 }), 100)).toBe(true)
    expect(canCreateCamp(account({ campQuota: 1 }), 1)).toBe(false)
    expect(canCreateCamp(account({ campQuota: 1 }), 0)).toBe(true)
  })

  it('refuses an account nobody has granted', () => {
    expect(canCreateCamp(null, 0)).toBe(false)
  })
})

describe('isAdminAccount', () => {
  it('is false without a grant, and false for a plain leader', () => {
    expect(isAdminAccount(null)).toBe(false)
    expect(isAdminAccount(account())).toBe(false)
    expect(isAdminAccount(account({ role: 'admin' }))).toBe(true)
  })
})

describe('normalizeEmail', () => {
  it('folds case and trims, so one address cannot become two grants', () => {
    expect(normalizeEmail('  Leader@Example.COM ')).toBe('leader@example.com')
  })
})

describe('isEmailish', () => {
  it('accepts an ordinary address', () => {
    expect(isEmailish('leader@example.com')).toBe(true)
    expect(isEmailish('  Leader@Example.com  ')).toBe(true)
  })

  it('rejects what could not reach an inbox', () => {
    expect(isEmailish('')).toBe(false)
    expect(isEmailish('leader')).toBe(false)
    expect(isEmailish('@example.com')).toBe(false)
    expect(isEmailish('leader@')).toBe(false)
    expect(isEmailish('a@b@c.com')).toBe(false)
    expect(isEmailish('lea der@example.com')).toBe(false)
  })
})

describe('clampQuota', () => {
  it('keeps a stepped value in range and whole', () => {
    expect(clampQuota(-3)).toBe(0)
    expect(clampQuota(2.4)).toBe(2)
    expect(clampQuota(MAX_CAMP_QUOTA + 5)).toBe(MAX_CAMP_QUOTA)
    expect(clampQuota(Number.NaN)).toBe(0)
  })
})

describe('isAccount', () => {
  it('accepts a well-formed row and rejects a broken one', () => {
    expect(isAccount(account())).toBe(true)
    expect(isAccount({ ...account(), role: 'owner' })).toBe(false)
    expect(isAccount({ ...account(), campQuota: '2' })).toBe(false)
    expect(isAccount(null)).toBe(false)
  })
})

describe('buildRoster', () => {
  const granted = account({ id: 'a1', email: 'anna@example.com' })
  const pending = account({ id: 'a2', email: 'zoe@example.com' })

  const users: RosterUser[] = [
    { id: 'u1', email: 'anna@example.com', accountId: 'a1' },
    { id: 'u2', email: 'ben@example.com', accountId: null },
  ]

  it('pairs a signed-in user with their grant', () => {
    const roster = buildRoster(users, [granted])
    expect(roster).toEqual([
      { userId: 'u1', email: 'anna@example.com', account: granted },
      { userId: 'u2', email: 'ben@example.com', account: null },
    ])
  })

  it('lists a grant whose person has never signed in', () => {
    const roster = buildRoster(users, [granted, pending])
    expect(roster.map((entry) => entry.email)).toEqual([
      'anna@example.com',
      'ben@example.com',
      'zoe@example.com',
    ])
    expect(roster[2]).toEqual({ userId: null, email: 'zoe@example.com', account: pending })
  })

  it('does not list a grant twice when its person has signed in', () => {
    const roster = buildRoster(
      [{ id: 'u1', email: 'ANNA@example.com', accountId: 'a1' }],
      [granted],
    )
    expect(roster).toHaveLength(1)
    expect(roster[0]?.userId).toBe('u1')
  })

  it('drops a dangling account link rather than the user', () => {
    const roster = buildRoster([{ id: 'u9', email: 'gone@example.com', accountId: 'a404' }], [])
    expect(roster).toEqual([{ userId: 'u9', email: 'gone@example.com', account: null }])
  })

  it('is empty for an empty app', () => {
    expect(buildRoster([], [])).toEqual([])
  })
})

describe('waitingForActivation', () => {
  const granted = account({ id: 'a1', email: 'anna@example.com' })
  const pending = account({ id: 'a2', email: 'zoe@example.com' })

  it('keeps only the people who signed in and have no grant', () => {
    const roster = buildRoster(
      [
        { id: 'u1', email: 'anna@example.com', accountId: 'a1' },
        { id: 'u2', email: 'ben@example.com', accountId: null },
      ],
      [granted],
    )
    expect(waitingForActivation(roster).map((entry) => entry.email)).toEqual(['ben@example.com'])
  })

  it('excludes a grant nobody has signed in against — that one is waiting on them', () => {
    const roster = buildRoster([], [pending])
    expect(waitingForActivation(roster)).toEqual([])
  })

  it('is empty when everyone is activated, and for an empty app', () => {
    expect(
      waitingForActivation(
        buildRoster([{ id: 'u1', email: 'anna@example.com', accountId: 'a1' }], [granted]),
      ),
    ).toEqual([])
    expect(waitingForActivation([])).toEqual([])
  })
})

describe('accountForEmail', () => {
  it('finds a grant however the address was typed', () => {
    const existing = account({ email: 'anna@example.com' })
    expect(accountForEmail([existing], ' ANNA@Example.com ')).toBe(existing)
    expect(accountForEmail([existing], 'ben@example.com')).toBeUndefined()
  })
})
