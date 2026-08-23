import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { en } from '../i18n/en'
import { I18nProvider } from '../i18n/I18nProvider'
import { useWriteState } from './useWriteState'

/** Every case needs the dictionary, so the provider is the wrapper throughout. */
function render(queryError?: { message: string }) {
  return renderHook(({ qe }: { qe?: { message: string } }) => useWriteState(qe), {
    wrapper: I18nProvider,
    initialProps: { qe: queryError },
  })
}

describe('useWriteState', () => {
  it('starts with no error', () => {
    const { result } = render()
    expect(result.current.error).toBeNull()
  })

  it('reports a write that rejects', async () => {
    const { result } = render()
    act(() => {
      result.current.run(Promise.reject(new Error('offline')))
    })
    await waitFor(() => expect(result.current.error).toBe(en.sync.writeFailed))
  })

  it('leaves a write that resolves alone', async () => {
    const { result } = render()
    act(() => {
      result.current.run(Promise.resolve())
    })
    // Nothing to wait for on the happy path, so flush the microtask queue instead.
    await act(async () => {})
    expect(result.current.error).toBeNull()
  })

  it('clears the last failure when the next write starts', async () => {
    const { result } = render()
    act(() => {
      result.current.run(Promise.reject(new Error('offline')))
    })
    await waitFor(() => expect(result.current.error).toBe(en.sync.writeFailed))

    act(() => {
      result.current.run(Promise.resolve())
    })
    expect(result.current.error).toBeNull()
  })

  it('reports a validation failure with the message it was given', () => {
    const { result } = render()
    act(() => {
      result.current.fail('That name is taken')
    })
    expect(result.current.error).toBe('That name is taken')
  })

  it('clears on demand', () => {
    const { result } = render()
    act(() => {
      result.current.fail('That name is taken')
    })
    act(() => {
      result.current.clearError()
    })
    expect(result.current.error).toBeNull()
  })

  it('lets a failed load outrank a pending write failure', async () => {
    const { result, rerender } = render()
    act(() => {
      result.current.run(Promise.reject(new Error('offline')))
    })
    await waitFor(() => expect(result.current.error).toBe(en.sync.writeFailed))

    rerender({ qe: { message: 'socket closed' } })
    expect(result.current.error).toBe(en.sync.loadFailed('socket closed'))
  })

  it('keeps its callbacks stable across renders', () => {
    const { result, rerender } = render()
    const first = result.current
    rerender({ qe: undefined })
    expect(result.current.run).toBe(first.run)
    expect(result.current.fail).toBe(first.fail)
    expect(result.current.clearError).toBe(first.clearError)
  })
})
