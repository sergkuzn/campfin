import { useEffect, useRef } from 'react'
import './ConfirmDialog.css'

type Props = {
  open: boolean
  title: string
  /** Body paragraphs. The caller composes them from real numbers, so the question
   *  always says what the button will actually cost. */
  lines: string[]
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * A modal confirmation built on the native `<dialog>`, which brings focus trapping,
 * Esc-to-close and a backdrop for free. `window.confirm` would block the main thread
 * and is suppressed outright in some installed-PWA contexts.
 */
export function ConfirmDialog({ open, title, lines, confirmLabel, onConfirm, onCancel }: Props) {
  // useRef holds a mutable box that survives re-renders without causing one. Passing it
  // as ref={} makes React put the real DOM node in .current after mount.
  const ref = useRef<HTMLDialogElement>(null)

  // A <dialog> keeps its open/closed state in the DOM, not in React, so React state has
  // to be pushed into it imperatively — synchronising with an external system.
  useEffect(() => {
    const dialog = ref.current
    if (dialog === null) return
    // Guarded both ways: showModal() on an already-open dialog throws.
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    // onCancel is React's handler for the dialog's native `cancel` event (Esc). Without
    // it the DOM would close the dialog behind React's back and `open` would go stale.
    <dialog className="confirm" ref={ref} onCancel={onCancel}>
      <h3 className="confirm__title">{title}</h3>
      {lines.map((line) => (
        <p key={line} className="confirm__line">
          {line}
        </p>
      ))}
      <div className="confirm__actions">
        <button className="confirm__button" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="confirm__button confirm__button--danger"
          type="button"
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
