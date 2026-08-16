import { useT } from '../i18n'
import { formatVersion, parseAppEnv } from '../lib/version'

/**
 * The build this phone is running, in the footer of every screen — including sign-in,
 * where auth problems get reported from.
 *
 * The `__APP_*` globals are Vite `define` substitutions (`vite.config.ts`); this
 * component is the single place that touches them, so everything else stays testable.
 * `VITE_APP_ENV` rides along because it answers the same question — which build is this,
 * and which database is it writing to.
 */
export function AppVersion() {
  const t = useT()
  const env = parseAppEnv(import.meta.env.VITE_APP_ENV)
  const text = formatVersion({
    version: __APP_VERSION__,
    commit: __APP_COMMIT__,
    builtAt: __APP_BUILT_AT__,
    env,
  })
  if (text === '') return null

  return (
    // A labelled <section> rather than a <footer>: inside <main> a footer carries no
    // role, so it cannot take an aria-label, and "v0.1.0 · 1a2b3c4" read out with no
    // context is meaningless.
    <section
      className={env === 'prod' ? 'app__version' : 'app__version app__version--test'}
      aria-label={t.app.versionLabel}
    >
      {text}
    </section>
  )
}
