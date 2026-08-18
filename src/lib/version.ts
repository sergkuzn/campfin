/**
 * The build identifier shown in the footer, so a leader reading a problem out over the
 * phone can say exactly which bundle their phone is running.
 *
 * Pure and argument-taking rather than reading the `__APP_*` globals itself: those exist
 * only after Vite's substitution, and a function that reads them could not be tested.
 */

/** Which InstantDB app — and therefore whose camp data — a build talks to. */
export type AppEnv = 'prod' | 'dev'

export type BuildInfo = {
  /** Package version, e.g. `0.1.0`. */
  version: string
  /** Short commit hash, or '' when the build had no git available. */
  commit: string
  /** Build date as `YYYY-MM-DD`. */
  builtAt: string
  /** Which database the build is pointed at. */
  env: AppEnv
}

/**
 * Reads the `VITE_APP_ENV` label. Only a literal `'prod'` counts as production: an
 * unlabelled build must not claim to be the real one, because a dev build silently
 * wearing no badge is how real receipts end up in the dev database.
 */
export function parseAppEnv(raw: string | undefined): AppEnv {
  return raw === 'prod' ? 'prod' : 'dev'
}

/**
 * Joins whatever parts a build actually knows about: `v0.1.0 · 1a2b3c4 · 2026-08-01`,
 * dropping any empty part so a git-less build reads `v0.1.0 · 2026-08-01` instead of
 * carrying a stray separator. A non-production build leads with its environment, so the
 * footer answers "which database am I in?" before it answers "which bundle?".
 */
export function formatVersion({ version, commit, builtAt, env }: BuildInfo): string {
  const parts = [env === 'prod' ? '' : env, version === '' ? '' : `v${version}`, commit, builtAt]
  return parts.filter((part) => part !== '').join(' · ')
}
