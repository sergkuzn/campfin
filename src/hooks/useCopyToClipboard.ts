import { useCallback, useEffect, useState } from 'react'

/** Idle, or the outcome of the last copy attempt. */
export type CopyState = 'idle' | 'copied' | 'failed'

/**
 * Copy text to the clipboard and report how it went, for a button that says "Copied" for a
 * moment afterwards. Shared by the join code and the participant link, which both hand a
 * leader something to paste into a chat.
 */
export function useCopyToClipboard(): [state: CopyState, copy: (text: string) => void] {
  const [state, setState] = useState<CopyState>('idle')

  // A timer is an external system, and it must be cleared if the component unmounts (or
  // the text is copied again) before it fires. Only the success message expires — a
  // failure should stay on screen until the next attempt.
  useEffect(() => {
    if (state !== 'copied') return
    const timer = window.setTimeout(() => setState('idle'), 2000)
    return () => window.clearTimeout(timer)
  }, [state])

  const copy = useCallback((text: string): void => {
    // `navigator.clipboard` is undefined outside a secure context, so reading it is itself
    // part of what can throw — hence the promise is built inside the `try`.
    const attempt = async () => {
      try {
        await navigator.clipboard.writeText(text)
        setState('copied')
      } catch {
        setState('failed')
      }
    }
    // `void` marks the floating promise as deliberate: the outcome lands in state.
    void attempt()
  }, [])

  return [state, copy]
}
