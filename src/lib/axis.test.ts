import { describe, expect, it } from 'vitest'
import { axisTicks, niceAxisTop, spacedTicks } from './axis'

describe('niceAxisTop', () => {
  it('covers the data', () => {
    for (const max of [1, 99, 100, 4300, 43_000, 123_456]) {
      expect(niceAxisTop(max).topCents).toBeGreaterThanOrEqual(max)
    }
  })

  it('lands on a round step rather than the raw maximum', () => {
    // €430 of pool money: a top of €500 in €100 steps, not the €600 a step-first
    // rounding produces.
    expect(niceAxisTop(43_000)).toEqual({ topCents: 50_000, stepCents: 10_000 })
  })

  it('keeps an exact multiple of a step as the top', () => {
    expect(niceAxisTop(50_000)).toEqual({ topCents: 50_000, stepCents: 10_000 })
  })

  it('never leaves more than six intervals below the top', () => {
    for (const max of [1, 37, 250, 4300, 43_000, 123_456, 9_999_999]) {
      const { topCents, stepCents } = niceAxisTop(max)
      expect(topCents / stepCents).toBeLessThanOrEqual(6)
    }
  })

  it('falls back to a one-euro axis for an empty camp', () => {
    // A flat zero line still needs a scale to be drawn against.
    expect(niceAxisTop(0)).toEqual({ topCents: 100, stepCents: 100 })
    expect(niceAxisTop(-5)).toEqual({ topCents: 100, stepCents: 100 })
  })
})

describe('axisTicks', () => {
  it('runs from zero to the top in even steps', () => {
    expect(axisTicks({ topCents: 50_000, stepCents: 10_000 })).toEqual([
      0, 10_000, 20_000, 30_000, 40_000, 50_000,
    ])
  })

  it('handles a single-step axis', () => {
    expect(axisTicks({ topCents: 100, stepCents: 100 })).toEqual([0, 100])
  })
})

describe('spacedTicks', () => {
  const days = (n: number) => Array.from({ length: n }, (_, i) => i + 1)

  it('keeps every value when they all fit', () => {
    expect(spacedTicks(days(6), 9)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('spaces a fortnight evenly rather than by label width', () => {
    // The collision-based thinning this replaces gave 1…10, 12, 15.
    expect(spacedTicks(days(15), 9)).toEqual([1, 3, 5, 7, 9, 11, 13, 15])
  })

  it('drops the last value rather than closing the gap unevenly', () => {
    expect(spacedTicks(days(14), 9)).toEqual([1, 3, 5, 7, 9, 11, 13])
  })

  it('never returns more than the labels asked for', () => {
    for (let length = 1; length <= 120; length++) {
      expect(spacedTicks(days(length), 9).length).toBeLessThanOrEqual(9)
    }
  })

  it('handles a camp with no days at all', () => {
    expect(spacedTicks([], 9)).toEqual([])
  })
})
