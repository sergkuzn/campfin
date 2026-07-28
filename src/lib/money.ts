/** Digits, optionally followed by a ',' or '.' separator and one or two decimals. */
const EURO_PATTERN = /^\d+([.,]\d{1,2})?$/

/**
 * Parse a euro string ("12", "12,50", "12.5") into integer cents, or null if it
 * isn't a valid non-negative amount with at most two decimal places.
 */
export function parseEurosToCents(input: string): number | null {
  const trimmed = input.trim()
  if (!EURO_PATTERN.test(trimmed)) return null

  const euros = Number(trimmed.replace(',', '.'))
  // Math.round is load-bearing: 19.99 * 100 === 1998.9999999999998 in binary floats.
  return Math.round(euros * 100)
}
