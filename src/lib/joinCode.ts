/**
 * A camp's id *is* its join code: "MOOR-7F3K". Human-typable, so the
 * alphabet drops the characters people confuse: I/1, O/0.
 *
 * Both functions are pure — randomness is injected, never taken from a global.
 */

/** No I, O, 0, 1. 32 symbols → 4 chars ≈ 1M codes, plenty for a personal tool. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export const SUFFIX_LENGTH = 4
export const PREFIX_LENGTH = 4

/**
 * "Moorwerder Sommercamp" → "MOOR". Letters and digits only, uppercased,
 * padded to 4 with 'X' so short names still yield a well-formed code.
 */
export function campPrefix(campName: string): string {
  return campName
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, PREFIX_LENGTH)
    .padEnd(PREFIX_LENGTH, 'X')
}

/**
 * "MOOR" + "-" + 4 random alphabet chars.
 * `random` returns a float in [0, 1) — the same contract as `Math.random`.
 */
export function generateJoinCode(campName: string, random: () => number = Math.random): string {
  let suffix = ''
  for (let i = 0; i < SUFFIX_LENGTH; i++) {
    const index = Math.floor(random() * CODE_ALPHABET.length)
    suffix += CODE_ALPHABET.charAt(index)
  }
  return `${campPrefix(campName)}-${suffix}`
}

/** Anything a human might type → canonical form. " moor7f3k " → "MOOR-7F3K". */
export function normalizeJoinCode(input: string): string {
  const cleaned = input.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  const prefix = cleaned.slice(0, PREFIX_LENGTH)
  const suffix = cleaned.slice(PREFIX_LENGTH)
  return suffix ? `${prefix}-${suffix}` : prefix
}
