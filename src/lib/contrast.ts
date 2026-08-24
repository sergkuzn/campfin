/**
 * WCAG contrast maths. Pure, and the reason the design tokens can be checked rather than
 * eyeballed: "is this green readable" has a number behind it, and the number is what the
 * palette test asserts.
 *
 * The bar the app holds itself to is 4.5:1 — the ratio the standard asks for on text below
 * roughly 18px. Almost every coloured string in this app is a 12–14px label, and it is read
 * on a phone in daylight, so the large-text allowance of 3:1 is not one worth taking.
 */

/** The threshold small text has to clear against whatever sits behind it. */
export const MIN_TEXT_CONTRAST = 4.5

/** `#abc` and `#aabbcc` both parse; anything else is a typo worth throwing over. */
export function parseHex(hex: string): [number, number, number] {
  const body = hex.replace('#', '')
  const full = body.length === 3 ? [...body].map((c) => c + c).join('') : body
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`Not a hex colour: ${hex}`)
  return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16)) as [number, number, number]
}

/**
 * Relative luminance, per WCAG 2.1. The gamma step is what makes this more than an average:
 * sRGB channel values are not linear in perceived light, so each is expanded back to linear
 * light before being weighted. Green carries most of the weight because the eye is most
 * sensitive to it — which is exactly why a mid green reads darker than its number suggests.
 */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((channel) => {
    const c = channel / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** The ratio between two colours, from 1 (identical) to 21 (black on white). Symmetric. */
export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a)
  const second = relativeLuminance(b)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}
