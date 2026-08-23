/**
 * Which of the two colour schemes the app is drawn in. Pure: this module decides *which*
 * theme is in force and what to store for it, never what the theme looks like — the token
 * values live in `index.css`, keyed off the `data-theme` attribute this yields.
 *
 * Light is the default, and deliberately not the phone's `prefers-color-scheme`: the app
 * opens the same way on both leaders' phones, and only an explicit tap changes that.
 */

export type Theme = 'light' | 'dark'

/** The default before anyone has chosen — also the fallback for anything unreadable. */
export const DEFAULT_THEME: Theme = 'light'

/** Where the choice is kept. Namespaced so it cannot collide with a draft or a token. */
export const THEME_STORAGE_KEY = 'campfin.theme'

/**
 * Reads a stored value back into a `Theme`. Storage hands back `string | null` — a key that
 * was never written, one written by an older build, or one a user edited by hand all arrive
 * the same way — so anything that is not exactly one of the two known values falls back to
 * the default rather than being trusted into the DOM.
 *
 * The return type is `Theme`, not `Theme | null`: callers have nothing useful to do with
 * "no choice yet" beyond using the default, so the narrowing happens once, here.
 */
export function parseTheme(raw: string | null): Theme {
  return raw === 'light' || raw === 'dark' ? raw : DEFAULT_THEME
}

/** The theme a tap on the toggle moves to. */
export function otherTheme(theme: Theme): Theme {
  return theme === 'light' ? 'dark' : 'light'
}

/**
 * The colour behind the phone's status bar and address bar, per theme. It has to match the
 * page's `--bg` or the chrome above the app reads as a different app; browsers cannot take
 * a `var()` here, so the two values are repeated from `index.css`.
 */
const THEME_COLORS: Record<Theme, string> = {
  light: '#fafafa',
  dark: '#0a0a0a',
}

export function themeColor(theme: Theme): string {
  return THEME_COLORS[theme]
}
