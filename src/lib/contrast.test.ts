import { describe, expect, it } from 'vitest'
import { contrastRatio, parseHex, relativeLuminance } from './contrast'

describe('parseHex', () => {
  it('reads the long and short forms alike', () => {
    expect(parseHex('#ffffff')).toEqual([255, 255, 255])
    expect(parseHex('#fff')).toEqual([255, 255, 255])
    expect(parseHex('#2563eb')).toEqual([37, 99, 235])
  })

  it('accepts a hex without its hash', () => {
    expect(parseHex('000000')).toEqual([0, 0, 0])
  })

  it('throws on anything that is not a colour', () => {
    expect(() => parseHex('#12345')).toThrow()
    expect(() => parseHex('rebeccapurple')).toThrow()
  })
})

describe('relativeLuminance', () => {
  it('spans 0 to 1 between black and white', () => {
    expect(relativeLuminance('#000000')).toBe(0)
    expect(relativeLuminance('#ffffff')).toBe(1)
  })

  it('weights green above red above blue, which is why mid greens read dark', () => {
    expect(relativeLuminance('#00ff00')).toBeGreaterThan(relativeLuminance('#ff0000'))
    expect(relativeLuminance('#ff0000')).toBeGreaterThan(relativeLuminance('#0000ff'))
  })
})

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for a colour on itself', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#2563eb', '#2563eb')).toBeCloseTo(1, 5)
  })

  it('does not care which colour is the background', () => {
    expect(contrastRatio('#15803d', '#ffffff')).toBeCloseTo(contrastRatio('#ffffff', '#15803d'), 10)
  })

  it('scores the green that was too pale below the one that replaced it', () => {
    // green-600 against a near-white page is ~3.0:1; green-700 clears 4.5:1.
    expect(contrastRatio('#16a34a', '#f5f5f5')).toBeLessThan(4.5)
    expect(contrastRatio('#15803d', '#f5f5f5')).toBeGreaterThan(4.5)
  })
})
