import { useEffect, useRef, useState } from 'react'
import './ConfirmDialog.css'
import { useBackDismiss } from '../hooks/useBackDismiss'
import { useT } from '../i18n'

type Props = {
  open: boolean
  title: string
  /** Body paragraphs. The caller composes them from real numbers, so the question
   *  always says what the button will actually cost. */
  lines: string[]
  confirmLabel: string
  /** When set, the confirm button stays disabled until the typed text matches `value`
   *  exactly (case-sensitive) — a GitHub-style guard against a reflexive tap on a
   *  destructive action too costly to undo. */
  requireText?: {
    value: string
    label: string
    placeholder: string
  }
  onConfirm: () => void
  onCancel: () => void
}

/**
 * A modal confirmation built on the native `<dialog>`, which brings focus trapping,
 * Esc-to-close and a backdrop for free. `window.confirm` would block the main thread
 * and is suppressed outright in some installed-PWA contexts.
 */
export function ConfirmDialog({
  open,
  title,
  lines,
  confirmLabel,
  requireText,
  onConfirm,
  onCancel,
}: Props) {
  const t = useT()
  // useRef holds a mutable box that survives re-renders without causing one. Passing it
  // as ref={} makes React put the real DOM node in .current after mount.
  const ref = useRef<HTMLDialogElement>(null)
  const [typed, setTyped] = useState('')

  // The phone's back gesture answers the question the same way Esc does — by declining it.
  // Android has no Esc key, so without this the only ways out are the backdrop and Cancel.
  useBackDismiss(open, onCancel)

  // A <dialog> keeps its open/closed state in the DOM, not in React, so React state has
  // to be pushed into it imperatively — synchronising with an external system.
  useEffect(() => {
    const dialog = ref.current
    if (dialog === null) return
    // Guarded both ways: showModal() on an already-open dialog throws.
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
    // Each opening starts from a blank field, so a stale match from a previous dialog
    // can't leave the confirm button already enabled.
    if (open) setTyped('')
  }, [open])

  const confirmDisabled = requireText !== undefined && typed !== requireText.value

  return (
    // onCancel is React's handler for the dialog's native `cancel` event (Esc). Without
    // it the DOM would close the dialog behind React's back and `open` would go stale.
    <dialog className="dialog confirm" ref={ref} onCancel={onCancel}>
      <h3 className="dialog__title">{title}</h3>
      {lines.map((line) => (
        <p key={line} className="confirm__line">
          {line}
        </p>
      ))}
      {requireText !== undefined && (
        <input
          className="confirm__input"
          aria-label={requireText.label}
          type="text"
          value={typed}
          placeholder={requireText.placeholder}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setTyped(event.target.value)}
        />
      )}
      <div className="dialog__actions">
        <button className="btn btn--ghost" type="button" onClick={onCancel}>
          {t.confirm.cancel}
        </button>
        <button
          className="btn btn--danger-fill"
          type="button"
          disabled={confirmDisabled}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
