/**
 * The build identifier shown in the footer, so a leader reading a problem out over the
 * phone can say exactly which bundle their phone is running.
 *
 * Pure and argument-taking rather than reading the `__APP_*` globals itself: those exist
 * only after Vite's substitution, and a function that reads them could not be tested.
 */

export type BuildInfo = {
  /** Package version, e.g. `0.1.0`. */
  version: string
  /** Short commit hash, or '' when the build had no git available. */
  commit: string
  /** Build date as `YYYY-MM-DD`. */
  builtAt: string
}

/**
 * Joins whatever parts a build actually knows about: `v0.1.0 · 1a2b3c4 · 2026-08-01`,
 * dropping any empty part so a git-less build reads `v0.1.0 · 2026-08-01` instead of
 * carrying a stray separator.
 */
export function formatVersion({ version, commit, builtAt }: BuildInfo): string {
  const parts = [version === '' ? '' : `v${version}`, commit, builtAt]
  return parts.filter((part) => part !== '').join(' · ')
}
