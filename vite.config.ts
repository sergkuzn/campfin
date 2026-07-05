/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Tailwind v4 is configured entirely in CSS (see src/index.css); no config file.
    tailwindcss(),
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
