import { useLayoutEffect } from 'react'

/**
 * Puts the document back at the top whenever `view` becomes a different value.
 *
 * Swapping screens by state rather than by URL leaves the browser's scroll offset alone,
 * so a tap on a button halfway down one screen lands halfway down the next. This is one of
 * the few honest uses of an effect: the scroll position lives in the browser, not in React
 * state, so it has to be synchronised after the DOM updates.
 *
 * `useLayoutEffect` runs after the DOM is updated but *before* the browser paints, which is
 * what keeps the jump invisible — with `useEffect` the new screen would be painted once at
 * the old offset and then snap upwards.
 *
 * The argument is compared by identity, so pass the navigation state object itself: it is
 * stable across ordinary re-renders (typing, a sync tick) and changes exactly on a
 * navigation — including a navigation to the screen already showing.
 *
 * The dependency array is suppressed below because `view` is a parameter of this hook,
 * which the lint rule cannot tell apart from a mutable outer-scope value. It is the one
 * dependency that matters: dropping it would scroll on mount only and restore the bug.
 */
export function useScrollToTop(view: unknown): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: a hook parameter is a real dependency
  useLayoutEffect(() => {
    // 'instant' rather than the default, so a later `scroll-behavior: smooth` rule cannot
    // turn navigation into an animated scroll up the page.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [view])
}
