import { useCallback, useEffect, useState } from 'react'
import { otherTheme, parseTheme, THEME_STORAGE_KEY, type Theme, themeColor } from '../lib/theme'

/**
 * `localStorage` throws rather than returning null in a few real situations — Safari's
 * private mode, an embedded webview with site data switched off — and a display preference
 * is never worth crashing the app over. Both accessors swallow the failure: reading falls
 * back to the default theme, writing silently doesn't stick for that session.
 */
export function readStoredTheme(): Theme {
  try {
    return parseTheme(window.localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return parseTheme(null)
  }
}

function storeTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Choice holds for this session only.
  }
}

/**
 * Puts the theme into the page: a `data-theme` attribute on `<html>`, which every colour
 * token in `index.css` keys off, plus the `<meta name="theme-color">` the phone paints its
 * status and address bars with.
 *
 * Exported because `main.tsx` calls it before the first render — the attribute has to be on
 * the element before anything paints, or a dark user sees a white flash while the bundle
 * boots.
 */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor(theme))
}

/**
 * The active theme and the way to flip it. State lives in React so the toggle's icon and
 * label re-render, while the DOM attribute is kept in step by an effect: `<html>` sits
 * outside the React tree, so it is an external system to synchronise with, which is exactly
 * what an effect is for.
 *
 * The write to storage is not in the effect — it belongs to the tap, not to the rendered
 * state. Keeping it in the handler means the stored key only ever exists because someone
 * chose, rather than being stamped with the default on every first load.
 *
 * One caller, `ThemeToggle`. Each call gets its own `useState`, so a second component
 * calling this would hold a copy that goes stale the moment the first one flips — if
 * anything else ever needs to know the theme, lift this into a context rather than
 * calling it twice.
 */
export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  // Passing the function itself, not `readStoredTheme()`: React calls a lazy initialiser
  // once on mount instead of re-reading storage on every render.
  const [theme, setTheme] = useState<Theme>(readStoredTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // `useCallback` keeps the handler's identity stable across renders, so the button it is
  // passed to is not handed a new prop every time the app re-renders on a sync tick.
  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = otherTheme(current)
      storeTheme(next)
      return next
    })
  }, [])

  return { theme, toggleTheme }
}
