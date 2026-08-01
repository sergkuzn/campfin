/// <reference types="vitest/config" />
import { execSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
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
export default defineConfig({
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
      // 'autoUpdate' silently installs new versions and auto-injects SW registration,
      // so there's no register code to write for the MVP. Revisit in milestone 5 if you
      // want a "new version available — reload" prompt (virtual:pwa-register/react).
      registerType: 'autoUpdate',
      manifest: {
        name: 'campfin — Camp Budget Tracker',
        short_name: 'campfin',
        description: 'Local-first camp budget tracker for two group leaders.',
        theme_color: '#0f172a',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // Keep the service worker out of `vite dev` so HMR stays simple; flip to test offline.
      devOptions: { enabled: false },
    }),
  ],
  // Vitest config lives here so tests share Vite's resolve/plugins. Tests import
  // { describe, it, expect } from 'vitest' explicitly (no globals) — see the test files.
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
