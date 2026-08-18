import { useCallback, useEffect, useRef, useState } from 'react'
import { dismissTopOverlay } from './useBackDismiss'

/**
 * Where a screen is stored inside a history entry. Namespaced because `history.state`
 * belongs to the page as a whole, not to this hook.
 */
const VIEW_KEY = 'campfinView'

/** `replace` overwrites the current entry instead of stacking a new one on top. */
type Navigate<V> = (next: V, mode?: 'push' | 'replace') => void

type ViewHistory<V> = [view: V, navigate: Navigate<V>, goBack: () => void]

/**
 * `useState` for the current screen, backed by the browser's session history.
 *
 * The app switches screens by state rather than by URL, so nothing was ever added to the
 * history stack and a back press had no app-level meaning: on Android it closed the
 * installed app outright. This hook records each navigation as a history entry holding the
 * screen it led to, and puts that screen back when the entry is returned to — which is what
 * every back affordance ends up doing, whether it is Android's button or gesture, iOS's
 * edge swipe, the desktop back button or a mouse's back button.
 *
 * `goBack` is that same step, triggered from a screen's own ← button, so the two are one
 * behaviour rather than two that can disagree. A ← that pushed the parent screen instead
 * would leave the screen just left sitting *ahead* of us, where the next back press would
 * walk into it.
 *
 * The root screen is deliberately never pushed. Back from there still leaves the app, as it
 * should — an app you cannot back out of is worse than one that never handled back at all.
 *
 * `V` is generic because the hook has no business knowing what a screen is; it only needs
 * the value to survive `structuredClone`, which every plain-data union does.
 *
 * `onNavigate` runs on every screen change from any of those sources — the place for work
 * that must happen however the screen was left, such as dropping a stale error banner.
 */
export function useViewHistory<V>(initial: V, onNavigate?: () => void): ViewHistory<V> {
  const [view, setView] = useState<V>(initial)

  // The listener below is attached once, so it cannot read `view` directly — it would
  // capture the first one forever. A ref is a box holding the current value.
  const viewRef = useRef(view)
  useEffect(() => {
    viewRef.current = view
  }, [view])

  // Frozen on the first render, mirroring how `useState` treats its argument: callers pass
  // an object literal, and a fresh one each render must not count as a change.
  const initialRef = useRef(initial)

  // The listener below is attached once and would otherwise call whichever `onNavigate` it
  // was given first, for the life of the app; a ref is a box it reads the current one from.
  const onNavigateRef = useRef(onNavigate)
  useEffect(() => {
    onNavigateRef.current = onNavigate
  }, [onNavigate])

  const navigate = useCallback<Navigate<V>>((next, mode = 'push') => {
    // A fresh entry rather than a copy of the old one, so nothing from the entry we are
    // leaving travels into the new screen's state.
    const entry = { [VIEW_KEY]: next }
    if (mode === 'replace') window.history.replaceState(entry, '')
    else window.history.pushState(entry, '')
    onNavigateRef.current?.()
    setView(next)
  }, [])

  // Deliberately not `setView(parent)`: going back through history is what keeps the stack
  // honest, and it is the one path every other back gesture already takes.
  const goBack = useCallback(() => window.history.back(), [])

  useEffect(() => {
    // Stamp the entry the app opened on. Without this, backing all the way to it would find
    // no screen recorded and fall through to the default — the same screen by luck, but not
    // by design.
    window.history.replaceState({ [VIEW_KEY]: initialRef.current }, '')

    const onPopState = (event: PopStateEvent) => {
      // An open dialog or row menu owns the press. The browser has already moved off the
      // current entry by the time this runs, so push an identical one back to undo it: the
      // overlay closes and the screen beneath is untouched.
      if (dismissTopOverlay()) {
        window.history.pushState({ [VIEW_KEY]: viewRef.current }, '')
        return
      }

      // `history.state` is untyped by definition — it is whatever was stored, deserialised.
      // Anything without our key came from outside the app, so fall back to the root screen
      // rather than trusting it.
      const state = event.state as Record<string, unknown> | null
      const stored = state === null ? undefined : (state[VIEW_KEY] as V | undefined)
      onNavigateRef.current?.()
      setView(stored ?? initialRef.current)
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  return [view, navigate, goBack]
}
