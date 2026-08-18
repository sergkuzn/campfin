/// <reference types="vitest/config" />
import { execSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
// A default import, not `{ version }`: under NodeNext a JSON module has only a default.
import pkg from './package.json' with { type: 'json' }

/** The commit the bundle was built from, or '' where git is missing (some CI images
 *  build from a tarball). An unidentifiable build is better than a failed one. */
function gitCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

// https://vite.dev/config/
// The config is a function because the PWA manifest depends on which database the build
// targets, and that is only known once the mode's env files are read.
export default defineConfig(({ mode }) => {
  // This file runs in Node, where `import.meta.env` does not exist. `loadEnv` is the
  // equivalent: it reads `.env`, `.env.local`, `.env.[mode]` and `.env.[mode].local`
  // (later wins) and folds in any VITE_-prefixed variable already in the process
  // environment — which is how the host supplies them on a deployed build.
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const isProd = env.VITE_APP_ENV === 'prod'

  return {
    // `define` is a compile-time text substitution: each identifier is replaced by this
    // literal in the bundle, so the version travels inside the build it describes and
    // costs nothing at runtime. The globals are declared for TS in `src/env.d.ts`.
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __APP_COMMIT__: JSON.stringify(gitCommit()),
      __APP_BUILT_AT__: JSON.stringify(new Date().toISOString().slice(0, 10)),
    },
    plugins: [
      react(),
      VitePWA({
        // 'prompt' keeps a newly downloaded service worker in its waiting state until the
        // user taps Reload (see `ReloadPrompt`). Under 'autoUpdate' the new worker takes
        // over immediately and swaps the cached assets beneath a page that is still
        // running — enough to break a lazy chunk the open page asks for later. Deferring
        // that to a tap also means a half-typed receipt is never reloaded away.
        registerType: 'prompt',
        manifest: {
          // A dev build installs as its own home-screen icon, under its own name and
          // colour: the two apps sit side by side on the same phone and must not be
          // mistakable for one another.
          name: isProd ? 'campfin — Camp Budget Tracker' : 'campfin DEV — Camp Budget Tracker',
          short_name: isProd ? 'campfin' : 'campfin DEV',
          description: isProd
            ? 'Local-first camp budget tracker.'
            : 'Dev build of campfin — writes to the dev database.',
          theme_color: isProd ? '#0f172a' : '#78350f',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        // Keep the service worker out of `vite dev` so HMR stays simple; flip it to try offline.
        devOptions: { enabled: false },
      }),
    ],
    // Vitest config lives here so tests share Vite's resolve/plugins. Tests import
    // { describe, it, expect } from 'vitest' explicitly (no globals) — see the test files.
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
    },
  }
})
