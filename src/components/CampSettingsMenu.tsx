import { useEffect, useRef, useState } from 'react'
import './CampSettingsMenu.css'
import { useT } from '../i18n'
import { ConfirmDialog } from './ConfirmDialog'

type Props = {
  campName: string
  /** Only the camp's admin may delete it; everyone else is offered rename alone. */
  canDelete: boolean
  onRename: (name: string) => void
  onDelete: () => void
}

/** Which modal is up. A union rather than two booleans, so "both open" cannot happen. */
type OpenDialog = 'none' | 'rename' | 'delete'

/**
 * The ⚙ menu next to the camp name: the actions that change the camp itself rather than
 * its money. They live here instead of on the dashboard because they are rare and one of
 * them is destructive — a delete button in the flow of daily use is a delete button that
 * gets hit by accident.
 */
export function CampSettingsMenu({ campName, canDelete, onRename, onDelete }: Props) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [dialog, setDialog] = useState<OpenDialog>('none')
  const rootRef = useRef<HTMLDivElement>(null)

  // Escape and clicks elsewhere are events on `document`, outside React's tree — an
  // external system, which is what effects are for. Listening only while the menu is
  // open keeps the handlers off the page the rest of the time.
  useEffect(() => {
    if (!open) return

    const closeOnOutside = (event: PointerEvent) => {
      const root = rootRef.current
      if (root !== null && !root.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const pick = (next: OpenDialog) => {
    setOpen(false)
    setDialog(next)
  }

  return (
    <div className="camp-settings" ref={rootRef}>
      <button
        className="camp-settings__toggle"
        type="button"
        aria-label={t.dashboard.settings.open}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        {/* The glyph carries no meaning a screen reader could use — the label above does. */}
        <span aria-hidden="true">⚙</span>
      </button>

      {open && (
        <div className="camp-settings__menu" role="menu">
          <button
            className="camp-settings__item"
            type="button"
            role="menuitem"
            onClick={() => pick('rename')}
          >
            {t.dashboard.settings.rename}
          </button>
          {canDelete && (
            <button
              className="camp-settings__item camp-settings__item--danger"
              type="button"
              role="menuitem"
              onClick={() => pick('delete')}
            >
              {t.dashboard.settings.delete}
            </button>
          )}
        </div>
      )}

      <RenameDialog
        open={dialog === 'rename'}
        currentName={campName}
        onSave={(name) => {
          setDialog('none')
          onRename(name)
        }}
        onCancel={() => setDialog('none')}
      />

      <ConfirmDialog
        open={dialog === 'delete'}
        title={t.dashboard.settings.deleteTitle}
        lines={[t.dashboard.settings.deleteConfirm(campName), t.dashboard.settings.deleteLine]}
        confirmLabel={t.dashboard.settings.deleteConfirmLabel}
        onConfirm={() => {
          setDialog('none')
          onDelete()
        }}
        onCancel={() => setDialog('none')}
      />
    </div>
  )
}

type RenameProps = {
  open: boolean
  currentName: string
  onSave: (name: string) => void
  onCancel: () => void
}

/**
 * Renaming needs a text field, which `ConfirmDialog` has no room for. Same native
 * `<dialog>` for the same reason `window.prompt` is avoided: it blocks the main thread
 * and installed PWAs may suppress it outright.
 */
function RenameDialog({ open, currentName, onSave, onCancel }: RenameProps) {
  const t = useT()
  const ref = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState(currentName)

  // A <dialog> keeps open/closed in the DOM, so React state has to be pushed into it.
  // Reopening also re-seeds the field, so a cancelled edit is not still sitting there.
  useEffect(() => {
    const dialog = ref.current
    if (dialog === null) return
    if (open && !dialog.open) {
      setName(currentName)
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
  }, [open, currentName])

  const trimmed = name.trim()

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (trimmed === '') return
    onSave(trimmed)
  }

  return (
    <dialog className="rename" ref={ref} onCancel={onCancel}>
      <form className="rename__form" onSubmit={handleSubmit}>
        <h3 className="rename__title">{t.dashboard.settings.renameTitle}</h3>
        <label className="rename__label" htmlFor="camp-rename">
          {t.dashboard.settings.renameLabel}
        </label>
        <input
          className="rename__input"
          id="camp-rename"
          type="text"
          value={name}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
        />
        <div className="rename__actions">
          <button className="rename__button" type="button" onClick={onCancel}>
            {t.confirm.cancel}
          </button>
          <button
            className="rename__button rename__button--primary"
            type="submit"
            disabled={trimmed === ''}
          >
            {t.dashboard.settings.save}
          </button>
        </div>
      </form>
    </dialog>
  )
}
