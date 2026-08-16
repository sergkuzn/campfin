import { describe, expect, it } from 'vitest'
import { isPoolColor, nextPoolColor, POOL_COLORS, poolColorOf } from './poolColors'
import type { Pool, PoolColor } from './types'

function pool(id: string, color?: PoolColor): Pool {
  return { id, campId: 'c1', name: id, role: 'earmarked', color, createdAt: 1 }
}

describe('poolColorOf', () => {
  it('returns the stored colour', () => {
    expect(poolColorOf(pool('p1', 'violet'))).toBe('violet')
  })

  it('derives a colour from the id when none is stored', () => {
    expect(POOL_COLORS).toContain(poolColorOf(pool('p1')))
  })

  it('derives the same colour every time for the same id', () => {
    // Both phones render an old pool identically only if this is a pure function of the id.
    expect(poolColorOf(pool('a-long-uuid-like-id'))).toBe(poolColorOf(pool('a-long-uuid-like-id')))
  })

  it('spreads different ids over more than one hue', () => {
    const ids = Array.from({ length: 40 }, (_, i) => `pool-${i}`)
    const hues = new Set(ids.map((id) => poolColorOf(pool(id))))
    expect(hues.size).toBeGreaterThan(1)
  })
})

describe('nextPoolColor', () => {
  it('starts at the front of the palette for the first pool', () => {
    expect(nextPoolColor([])).toBe(POOL_COLORS[0])
  })

  it('skips a colour a sibling already has', () => {
    const first = POOL_COLORS[0] as PoolColor
    expect(nextPoolColor([pool('p1', first)])).toBe(POOL_COLORS[1])
  })

  it('skips the colour an uncoloured pool falls back to', () => {
    const existing = pool('p1')
    expect(nextPoolColor([existing])).not.toBe(poolColorOf(existing))
  })

  it('wraps round rather than returning nothing once every hue is taken', () => {
    const all = POOL_COLORS.map((color, i) => pool(`p${i}`, color))
    expect(POOL_COLORS).toContain(nextPoolColor(all))
  })
})

describe('isPoolColor', () => {
  it('accepts every palette entry and nothing else', () => {
    for (const color of POOL_COLORS) expect(isPoolColor(color)).toBe(true)
    expect(isPoolColor('#ff0000')).toBe(false)
    expect(isPoolColor(undefined)).toBe(false)
    expect(isPoolColor(7)).toBe(false)
  })
})
