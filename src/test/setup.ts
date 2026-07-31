// Vitest setup, wired via `test.setupFiles` in vite.config.ts.
// Registers @testing-library/jest-dom matchers (e.g. `toBeInTheDocument`) and
// unmounts React trees after each test so they don't leak between cases.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
