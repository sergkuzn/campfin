import './ThemeToggle.css'
import { useTheme } from '../hooks/useTheme'
import { useT } from '../i18n'

/**
 * The day/night switch, pinned to the top-right corner of the app shell.
 *
 * The icon shows the theme you would get by tapping, not the one you are in: a sun in the
 * dark means "go light". That is the convention every OS uses, and it is the only reading
 * that answers the question someone taps the button to ask.
 *
 * `aria-label` rather than visible text — the glyph carries the meaning on screen, and a
 * word beside it would crowd the header on a phone.
 */
export function ThemeToggle() {
  const t = useT()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? t.theme.switchToLight : t.theme.switchToDark}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

/* Inline SVG rather than an image file or an emoji: it inherits `currentColor`, so it
   recolours with the theme, and it is in the bundle already — no second request, and no
   frame where the icon is missing. `aria-hidden` because the button is already named. */

function SunIcon() {
  return (
    <svg
      className="theme-toggle__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg
      className="theme-toggle__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* A crescent drawn as one path: the arc of the moon's edge, closed by the arc of
          the shadow that bites into it. */}
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
    </svg>
  )
}
