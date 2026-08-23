import { useEffect, useState } from 'react'
import './Toast.css'

/** Long enough to read a short sentence, short enough not to linger over the dashboard. */
const AUTO_DISMISS_MS = 5000

type Props = {
  message: string
}

/**
 * A centered, self-timing warning. Dismissal is local state rather than a prop the caller
 * controls: mounting the component (via `{error !== null && <Toast .../>}` at the call
 * site) is what shows it, and either the timer or the × button hides it by unmounting —
 * the caller's own error state is left alone either way.
 */
export function Toast({ message }: Props) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDismissed(true), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [])

  if (dismissed) return null

  return (
    <div className="toast-overlay">
      <div className="toast" role="alert">
        <p className="toast__message">{message}</p>
        <button
          type="button"
          className="toast__close"
          onClick={() => setDismissed(true)}
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </div>
  )
}
