/**
 * Build-time constants substituted by Vite's `define` (see `vite.config.ts`). They are
 * not real variables — nothing declares them at runtime — so TypeScript only learns
 * about them here.
 */
declare const __APP_VERSION__: string
/** Short commit hash, or '' when the build had no git available. */
declare const __APP_COMMIT__: string
/** Build date as `YYYY-MM-DD`. */
declare const __APP_BUILT_AT__: string

/**
 * Opting out of Vite's `any` fallback for `import.meta.env.*`. Without this every key —
 * including a misspelt one — types as `any`; with it, only the variables declared below
 * (plus Vite's own MODE/DEV/PROD/BASE_URL/SSR) exist, so a typo is a compile error rather
 * than a build that quietly points at no database.
 */
interface ViteTypeOptions {
  strictImportMetaEnv: unknown
}

/**
 * The environment variables this app reads. Both are optional because a build really can
 * be missing them, and the code that reads them handles that case.
 */
interface ImportMetaEnv {
  /** InstantDB app id — which database this build talks to. */
  readonly VITE_INSTANT_APP_ID?: string
  /** Exactly `'prod'` for the real camp data; anything else is treated as a dev build. */
  readonly VITE_APP_ENV?: string
}
