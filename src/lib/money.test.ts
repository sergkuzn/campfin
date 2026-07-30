import { describe, expect, it } from 'vitest'
import { parseEurosToCents } from './money'

describe('parseEurosToCents', () => {
  it('parses whole and fractional euros', () => {
    expect(parseEurosToCents('12')).toBe(1200)
    expect(parseEurosToCents('0')).toBe(0)
    expect(parseEurosToCents('12.5')).toBe(1250)
    expect(parseEurosToCents('8,00')).toBe(1250)
  })
  it('rounds without float drift', () => {
    expect(parseEurosToCents('19.99')).toBe(1999)
    expect(parseEurosToCents('0.1')).toBe(10)
  })
  it('trims surrounding whitespace', () => {
    expect(parseEurosToCents('  7,25  ')).toBe(725)
  })
  it('rejects invalid or negative input', () => {
    expect(parseEurosToCents('')).toBeNull()
    expect(parseEurosToCents('abc')).toBeNull()
    expect(parseEurosToCents('-5')).toBeNull()
    expect(parseEurosToCents('1.234')).toBeNull() // 3 decimals — reject, don't guess
  })
})
