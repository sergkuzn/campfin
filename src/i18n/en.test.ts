import { describe, expect, it } from 'vitest'
import { en } from './en'

/** Every leaf of the nested dictionary, with the property path that reaches it. */
function leaves(node: unknown, path: string): [string, unknown][] {
  if (typeof node !== 'object' || node === null) return [[path, node]]
  return Object.entries(node).flatMap(([key, value]) =>
    leaves(value, path === '' ? key : `${path}.${key}`),
  )
}

describe('the English dictionary', () => {
  it('has no empty or whitespace-only strings', () => {
    const blank = leaves(en, '')
      .filter(([, value]) => typeof value === 'string' && value.trim() === '')
      .map(([path]) => path)
    expect(blank).toEqual([])
  })

  it('contains only strings and interpolation functions', () => {
    const wrong = leaves(en, '')
      .filter(([, value]) => typeof value !== 'string' && typeof value !== 'function')
      .map(([path]) => path)
    expect(wrong).toEqual([])
  })

  it('branches its plurals on n', () => {
    expect(en.blocks.days(1)).toBe('1 day')
    expect(en.blocks.days(2)).toBe('2 days')
    expect(en.blocks.personDays(1)).toBe('1 person-day')
    expect(en.blocks.personDays(0)).toBe('0 person-days')
    expect(en.pools.deleteSources(1, '€1')).toContain('1 income source ')
    expect(en.pools.deleteSources(2, '€1')).toContain('2 income sources ')
  })

  it('interpolates its arguments rather than dropping them', () => {
    expect(en.camps.nameTaken('Moorwerder')).toContain('Moorwerder')
    expect(en.dashboard.deleteConfirm('Moorwerder')).toContain('Moorwerder')
    expect(en.pools.sourceDeleteLine('€20,00', 'Everyday')).toContain('€20,00')
    expect(en.pools.sourceDeleteLine('€20,00', 'Everyday')).toContain('Everyday')
  })
})
