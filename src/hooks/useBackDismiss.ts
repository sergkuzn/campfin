import { useEffect, useRef } from 'react'

/**
 * Every overlay currently on screen, oldest first, each represented by the function that
 * closes it.
 *
 * A plain module-level array rather than React state or a context: the one `popstate`
 * listener that reacts to a back press has to read this synchronously, from outside the
 * React tree, and it must see the same stack no matter which component opened the overlay.
 * Nothing renders from it, so there is nothing for React to keep in sync.
 */
const layers: Array<() => void> = []

/**
 * Closes the overlay opened most recently and reports whether there was one.
 *
 * The caller — the history listener in `useViewHistory` — uses the answer to decide
 * whether a back press was spent dismissing something or should move a whole screen.
 */
export function dismissTopOverlay(): boolean {
  const dismiss = layers.pop()
  if (dismiss === undefined) return false
  dismiss()
  return true
}

/**
 * Lets the system back gesture close an overlay — Android's back button or gesture, iOS's
 * left-edge swipe, the desktop back button, a mouse's back button — instead of leaving the
 * screen underneath it. All of those do the same thing to the page, so registering here is
 * all any of them needs.
 *
 * Call it from any component with a dismissable layer: `useBackDismiss(open, onCancel)`.
 * The layer is registered only while `open`, and the topmost one wins, so a confirm dialog
 * opened from a row menu is the one that closes first.
 */
export function useBackDismiss(open: boolean, onDismiss: () => void): void {
  // The "latest ref" pattern. The registry holds one entry for as long as the overlay is
  // open, but the parent hands us a freshly created `onDismiss` closure on every render.
  // Registering the function itself would mean unregistering and re-registering constantly;
  // registering a stable wrapper around a box we keep up to date does not.
  const dismissRef = useRef(onDismiss)
  useEffect(() => {
    dismissRef.current = onDismiss
  }, [onDismiss])

  // Synchronising with something outside React — a module-level stack read by a DOM event
  // listener — which is what an effect is for.
  useEffect(() => {
    if (!open) return

    const entry = () => dismissRef.current()
    layers.push(entry)
    return () => {
      // `indexOf` rather than `pop`: an overlay can close while another sits above it (a
      // sync tick disabling the row underneath), and removing the wrong layer would leave
      // a dialog that no back press can reach. A layer already taken off by
      // `dismissTopOverlay` gives -1 and is skipped.
      const at = layers.indexOf(entry)
      if (at !== -1) layers.splice(at, 1)
    }
  }, [open])
}
