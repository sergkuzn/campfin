import { useCallback, useEffect, useRef, useState } from 'react'
import './RowMenu.css'
import { useBackDismiss } from '../hooks/useBackDismiss'
import { useT } from '../i18n'

export type RowMenuItem = {
  label: string
  /** Red — for the one choice that destroys something. */
  danger?: boolean
  onSelect: () => void
}

type Props = {
  /** Names the row in the trigger's accessible label — a bare ⋮ says nothing on its own. */
  label: string
  /** True while a form is open elsewhere: the row's actions go inert, and an already-open
   *  menu closes rather than offering choices that would do nothing. */
  disabled: boolean
  /** Top to bottom, as shown. A pool header carries four, a receipt row two. */
  items: RowMenuItem[]
}

/** Roughly one item's height, for the drop-up estimate below. */
const ITEM_HEIGHT_PX = 40

/**
 * The ⋮ in a row's corner: the row's actions, hidden until asked for. Spelling them out as
 * buttons costs a whole extra line on a phone, which is what pushed the receipt rows to
 * wrap — and a pool header has four of them to fit beside a name and an amount.
 */
export function RowMenu({ label, disabled, items }: Props) {
  const t = useT()
  const [open, setOpen] = useState(false)
  // Opens upwards for a row near the bottom of the screen, where a downward menu would
  // fall past the viewport with nothing below it to scroll to.
  const [dropUp, setDropUp] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // An open menu is a layer over the screen, so the back gesture should take it away
  // rather than the whole screen — the touch equivalent of the Escape handler below.
  const close = useCallback(() => setOpen(false), [])
  useBackDismiss(open, close)

  // An open menu must close when anything outside it is touched. Those listeners live on
  // the document, outside React's tree, so they need attaching and removing by hand —
  // that is what an effect with a cleanup function is for.
  useEffect(() => {
    if (!open) return

    const closeOnOutside = (event: PointerEvent) => {
      // A tap on the trigger itself is inside, so it falls through to onClick and toggles
      // instead of closing here and reopening a moment later.
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      // Dismissing without choosing puts focus back where it came from.
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  // A row can go inert with its menu still up — the other leader's edit arrived mid-sync.
  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  const toggle = () => {
    if (!open) {
      const bottom = triggerRef.current?.getBoundingClientRect().bottom ?? 0
      // An estimate is enough: it only picks which side of the trigger the panel opens on,
      // and being a few pixels out never clips anything.
      setDropUp(bottom + items.length * ITEM_HEIGHT_PX > window.innerHeight)
    }
    setOpen(!open)
  }

  const choose = (action: () => void) => {
    setOpen(false)
    action()
  }

  return (
    <div className="row-menu" ref={containerRef}>
      <button
        className="row-menu__trigger"
        type="button"
        ref={triggerRef}
        disabled={disabled}
        aria-label={t.rowMenu.open(label)}
        // A disclosure, not an ARIA `menu`: that role promises arrow-key navigation, and
        // claiming it without implementing it is worse than plain buttons a Tab reaches.
        aria-expanded={open}
        onClick={toggle}
      >
        {/* The glyph is decoration; the button's name comes from aria-label above. */}
        <span aria-hidden="true">⋮</span>
      </button>

      {open && (
        <div className={`row-menu__items${dropUp ? ' row-menu__items--up' : ''}`}>
          {items.map((item) => (
            <button
              key={item.label}
              className={
                item.danger === true ? 'row-menu__item row-menu__item--danger' : 'row-menu__item'
              }
              type="button"
              onClick={() => choose(item.onSelect)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
