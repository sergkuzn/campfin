import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { dismissTopOverlay, useBackDismiss } from './useBackDismiss'

describe('useBackDismiss', () => {
  it('reports that there was nothing to dismiss when no overlay is open', () => {
    expect(dismissTopOverlay()).toBe(false)
  })

  it('dismisses an open overlay and reports it', () => {
    const onDismiss = vi.fn()
    renderHook(() => useBackDismiss(true, onDismiss))

    expect(dismissTopOverlay()).toBe(true)
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('ignores an overlay that is not open', () => {
    const onDismiss = vi.fn()
    renderHook(() => useBackDismiss(false, onDismiss))

    expect(dismissTopOverlay()).toBe(false)
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('closes the most recent overlay first — a dialog opened over a row menu wins', () => {
    const menu = vi.fn()
    const dialog = vi.fn()
    renderHook(() => useBackDismiss(true, menu))
    renderHook(() => useBackDismiss(true, dialog))

    dismissTopOverlay()
    expect(dialog).toHaveBeenCalledOnce()
    expect(menu).not.toHaveBeenCalled()

    dismissTopOverlay()
    expect(menu).toHaveBeenCalledOnce()
  })

  it('forgets an overlay closed by a tap, so the next back press moves a screen', () => {
    const onDismiss = vi.fn()
    const { rerender } = renderHook(({ open }) => useBackDismiss(open, onDismiss), {
      initialProps: { open: true },
    })

    rerender({ open: false })

    expect(dismissTopOverlay()).toBe(false)
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('unregisters on unmount, so a screen swapped away cannot swallow a back press', () => {
    const onDismiss = vi.fn()
    const { unmount } = renderHook(() => useBackDismiss(true, onDismiss))

    unmount()

    expect(dismissTopOverlay()).toBe(false)
  })

  it('calls the latest callback, not the one captured when the overlay opened', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(({ onDismiss }) => useBackDismiss(true, onDismiss), {
      initialProps: { onDismiss: first },
    })

    rerender({ onDismiss: second })
    dismissTopOverlay()

    expect(second).toHaveBeenCalledOnce()
    expect(first).not.toHaveBeenCalled()
  })
})
