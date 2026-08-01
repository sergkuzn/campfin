// Vitest setup, wired via `test.setupFiles` in vite.config.ts.
// Registers @testing-library/jest-dom matchers (e.g. `toBeInTheDocument`) and
// unmounts React trees after each test so they don't leak between cases.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom reflects <dialog>'s `open` attribute — and its stylesheet hides a closed one —
// but implements neither showModal() nor close(). Modelling them as that attribute is
// enough for the dialogs here: what the tests assert is which one is on screen, not the
// focus trap or the backdrop.
if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
}

afterEach(() => {
  cleanup()
})
