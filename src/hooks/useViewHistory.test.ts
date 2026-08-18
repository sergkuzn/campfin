import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useBackDismiss } from './useBackDismiss'
import { useViewHistory } from './useViewHistory'

type View = { screen: 'list' } | { screen: 'dashboard'; campId: string }

const list: View = { screen: 'list' }

/**
 * A history traversal is asynchronous in jsdom exactly as in a browser, so the assertion
 * has to wait for the `popstate` it fires rather than for the `back()` call to return.
 * The listener is attached after the hook's, so the hook has already handled the event.
 */
async function pressBack(goBack: () => void = () => window.history.back()): Promise<void> {
  const popped = new Promise<void>((resolve) => {
    window.addEventListener('popstate', () => resolve(), { once: true })
  })
  await act(async () => {
    goBack()
    await popped
  })
}

describe('useViewHistory', () => {
  it('shows the screen it was given', () => {
    const { result } = renderHook(() => useViewHistory<View>(list))
    expect(result.current[0]).toEqual(list)
  })

  it('returns to the previous screen when the back gesture is used', async () => {
    const { result } = renderHook(() => useViewHistory<View>(list))

    act(() => result.current[1]({ screen: 'dashboard', campId: 'c1' }))
    expect(result.current[0]).toEqual({ screen: 'dashboard', campId: 'c1' })

    await pressBack()
    expect(result.current[0]).toEqual(list)
  })

  it('walks back one screen at a time through a stack of them', async () => {
    const { result } = renderHook(() => useViewHistory<View>(list))

    act(() => result.current[1]({ screen: 'dashboard', campId: 'c1' }))
    act(() => result.current[1]({ screen: 'dashboard', campId: 'c2' }))

    await pressBack()
    expect(result.current[0]).toEqual({ screen: 'dashboard', campId: 'c1' })

    await pressBack()
    expect(result.current[0]).toEqual(list)
  })

  it('leaves no entry behind when a navigation replaces the current one', async () => {
    const { result } = renderHook(() => useViewHistory<View>(list))

    act(() => result.current[1]({ screen: 'dashboard', campId: 'gone' }))
    act(() => result.current[1](list, 'replace'))

    // The deleted camp's screen was overwritten, so back skips straight past it.
    await pressBack()
    expect(result.current[0]).toEqual(list)
  })

  it('spends the back press on an open overlay and stays on the screen', async () => {
    const onDismiss = vi.fn()
    const { result } = renderHook(
      ({ open }) => {
        const history = useViewHistory<View>(list)
        useBackDismiss(open, onDismiss)
        return history
      },
      { initialProps: { open: true } },
    )

    act(() => result.current[1]({ screen: 'dashboard', campId: 'c1' }))

    await pressBack()
    expect(onDismiss).toHaveBeenCalledOnce()
    expect(result.current[0]).toEqual({ screen: 'dashboard', campId: 'c1' })

    // The entry the overlay consumed was put back, so the next press does move a screen.
    await pressBack()
    expect(result.current[0]).toEqual(list)
  })

  it("takes a screen's own back button through the same history step", async () => {
    const { result } = renderHook(() => useViewHistory<View>(list))

    act(() => result.current[1]({ screen: 'dashboard', campId: 'c1' }))
    await pressBack(result.current[2])
    expect(result.current[0]).toEqual(list)
  })

  it('leaves nothing ahead of us after its own back button — the next press does not return', async () => {
    const { result } = renderHook(() => useViewHistory<View>(list))

    act(() => result.current[1]({ screen: 'dashboard', campId: 'c1' }))
    act(() => result.current[1]({ screen: 'dashboard', campId: 'c2' }))
    await pressBack(result.current[2])

    // Had ← pushed 'c1' instead of stepping back, 'c2' would still sit ahead of it and
    // this press would walk forward into the screen just left.
    await pressBack()
    expect(result.current[0]).toEqual(list)
  })

  it('reports every screen change, however it was made', async () => {
    const onNavigate = vi.fn()
    const { result } = renderHook(() => useViewHistory<View>(list, onNavigate))

    act(() => result.current[1]({ screen: 'dashboard', campId: 'c1' }))
    expect(onNavigate).toHaveBeenCalledTimes(1)

    await pressBack()
    expect(onNavigate).toHaveBeenCalledTimes(2)
  })

  it('falls back to the first screen for a history entry that is not ours', () => {
    const { result } = renderHook(() => useViewHistory<View>(list))

    act(() => result.current[1]({ screen: 'dashboard', campId: 'c1' }))
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: { somethingElse: true } }))
    })

    expect(result.current[0]).toEqual(list)
  })
})
