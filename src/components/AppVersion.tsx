import { useT } from '../i18n'
import { formatVersion } from '../lib/version'

/**
 * The build this phone is running, in the footer of every screen — including sign-in,
 * where auth problems get reported from.
 *
 * The `__APP_*` globals are Vite `define` substitutions (`vite.config.ts`); this
 * component is the single place that touches them, so everything else stays testable.
 */
export function AppVersion() {
  const t = useT()
  const text = formatVersion({
    version: __APP_VERSION__,
    commit: __APP_COMMIT__,
    builtAt: __APP_BUILT_AT__,
  })
  if (text === '') return null

  return (
    // A labelled <section> rather than a <footer>: inside <main> a footer carries no
    // role, so it cannot take an aria-label, and "v0.1.0 · 1a2b3c4" read out with no
    // context is meaningless.
    <section className="app__version" aria-label={t.app.versionLabel}>
      {text}
    </section>
  )
}
