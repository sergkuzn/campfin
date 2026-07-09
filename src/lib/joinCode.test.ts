import { describe, expect, it } from 'vitest'
import { CODE_ALPHABET, campPrefix, generateJoinCode, normalizeJoinCode } from './joinCode'

describe('campPrefix', () => {
  it('takes the first four alphanumerics, uppercased', () => {
    expect(campPrefix('Moorwerder Sommercamp 2026')).toBe('MOOR')
  })
  it('skips spaces and punctuation', () => {
    expect(campPrefix('a b-c d e')).toBe('ABCD')
  })
  it('keeps digits', () => {
    expect(campPrefix('2026 camp')).toBe('2026')
  })
  it('pads a short name with X', () => {
    expect(campPrefix('Ha')).toBe('HAXX')
  })
  it('pads an empty name', () => {
    expect(campPrefix('')).toBe('XXXX')
  })
})

describe('generateJoinCode', () => {
  // A fake `random` makes a random function testable: inject the sequence.
  const fakeRandom = (values: number[]): (() => number) => {
    let i = 0
    // `?? 0` because noUncheckedIndexedAccess types values[n] as `number | undefined`.
    return () => values[i++ % values.length] ?? 0
  }

  it('is PREFIX-SUFFIX with four chars each', () => {
    expect(generateJoinCode('Moorwerder', fakeRandom([0]))).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/)
  })
  it('random() === 0 picks the first alphabet char every time', () => {
    expect(generateJoinCode('Moorwerder', fakeRandom([0]))).toBe('MOOR-AAAA')
  })
  it('walks the alphabet with the injected randoms', () => {
    // index = floor(r * 32): 0 → A, 1/32 → B, 2/32 → C, 31/32 → 9 (last char)
    const random = fakeRandom([0, 1 / 32, 2 / 32, 31 / 32])
    expect(generateJoinCode('Moorwerder', random)).toBe('MOOR-ABC9')
  })
  it('never emits a character outside the alphabet', () => {
    const code = generateJoinCode('Test camp', fakeRandom([0.99999]))
    for (const char of code.slice(5)) {
      expect(CODE_ALPHABET).toContain(char)
    }
  })
})

describe('normalizeJoinCode', () => {
  it('uppercases and inserts the dash', () => {
    expect(normalizeJoinCode('moor7f3k')).toBe('MOOR-7F3K')
  })
  it('is idempotent on an already-canonical code', () => {
    expect(normalizeJoinCode('MOOR-7F3K')).toBe('MOOR-7F3K')
  })
  it('strips whitespace and stray punctuation', () => {
    expect(normalizeJoinCode('  moor 7f3k  ')).toBe('MOOR-7F3K')
  })
  it('leaves a too-short input dashless rather than inventing characters', () => {
    expect(normalizeJoinCode('moor')).toBe('MOOR')
  })
})
