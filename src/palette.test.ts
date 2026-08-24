import { describe, expect, it } from 'vitest'
// `?raw` hands the file over as a string instead of injecting it into the page — Vite's own
// mechanism, so the test reads the stylesheet the app actually ships rather than a copy of
// its values kept in sync by hand.
import POOL_CSS from './components/PoolTag.css?raw'
import INDEX_CSS from './index.css?raw'
import { contrastRatio, MIN_TEXT_CONTRAST } from './lib/contrast'

/**
 * The design tokens are readable by measurement, not by opinion. The day palette went pale
 * enough to be hard to read once — a green at 3:1 against a near-white card — and this is
 * what stops the next one from getting in.
 *
 * Both themes are held to the same bar because both are shipped: night is no longer what
 * you get for having a dark phone, it is a choice, and day is what everyone starts on.
 */

/** A regex group that has to have matched. Missing means the stylesheet moved under us. */
function group(match: RegExpMatchArray, index: number): string {
  const value = match[index]
  if (value === undefined) throw new Error(`Group ${index} did not match in: ${match[0]}`)
  return value
}

/** Pulls the `--name: #hex` declarations out of one rule block. */
function tokensIn(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(selector)
  if (start === -1) throw new Error(`No ${selector} block in the stylesheet`)
  const body = css.slice(start + selector.length).split('}')[0] ?? ''
  return Object.fromEntries(
    [...body.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{3,8})/g)].map((m) => [group(m, 1), group(m, 2)]),
  )
}

/** A token that has to exist. A renamed or dropped one should fail here, loudly. */
function token(tokens: Record<string, string>, name: string): string {
  const value = tokens[name]
  if (value === undefined) throw new Error(`No --${name} in this theme`)
  return value
}

const THEMES = {
  day: tokensIn(INDEX_CSS, ':root {'),
  night: tokensIn(INDEX_CSS, ':root[data-theme="dark"] {'),
}

/** Tokens drawn as text somewhere in the app, so all of them have to clear the text bar. */
const INK_TOKENS = ['fg', 'muted', 'accent', 'ok', 'warn', 'danger']

describe.each(Object.entries(THEMES))('the %s palette', (_theme, tokens) => {
  it.each(INK_TOKENS)('draws --%s readably on the page and on a card', (name) => {
    expect(contrastRatio(token(tokens, name), token(tokens, 'bg'))).toBeGreaterThanOrEqual(
      MIN_TEXT_CONTRAST,
    )
    expect(contrastRatio(token(tokens, name), token(tokens, 'surface'))).toBeGreaterThanOrEqual(
      MIN_TEXT_CONTRAST,
    )
  })

  it('keeps --on-accent readable on every solid fill it lands on', () => {
    // The one token never drawn on the page: it only ever sits on a filled button.
    for (const fill of ['accent', 'ok', 'danger']) {
      expect(contrastRatio(token(tokens, 'on-accent'), token(tokens, fill))).toBeGreaterThanOrEqual(
        MIN_TEXT_CONTRAST,
      )
    }
  })

  it('draws --border as a line you can see against the page', () => {
    // A hairline is not text, so it is not held to 4.5 — but it has to read as a line,
    // which the day theme's old near-white border, at 1.2:1, did not.
    expect(contrastRatio(token(tokens, 'border'), token(tokens, 'bg'))).toBeGreaterThan(1.6)
  })
})

describe('the pool palette', () => {
  /** Each hue declares its ink then its tint, eight for day followed by eight for night. */
  const pairs = [
    ...POOL_CSS.matchAll(/--pool-ink:\s*(#[0-9a-f]{6});\s*--pool-tint:\s*(#[0-9a-f]{6});/g),
  ].map((m) => ({ ink: group(m, 1), tint: group(m, 2) }))

  it('declares all eight hues in both themes', () => {
    expect(pairs).toHaveLength(16)
  })

  it('names every pool readably on its own pill', () => {
    for (const { ink, tint } of pairs) {
      expect(contrastRatio(ink, tint)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)
    }
  })

  it('names every pool readably straight on the page, where the tag has no pill', () => {
    const perTheme = [
      { tokens: THEMES.day, inks: pairs.slice(0, 8) },
      { tokens: THEMES.night, inks: pairs.slice(8) },
    ]
    for (const { tokens, inks } of perTheme) {
      for (const { ink } of inks) {
        expect(contrastRatio(ink, token(tokens, 'bg'))).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)
      }
    }
  })
})
