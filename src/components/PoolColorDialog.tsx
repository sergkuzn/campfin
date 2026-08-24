import { useEffect, useId, useRef } from 'react'
import './PoolColorDialog.css'
// The swatches use the palette classes, so the stylesheet that defines them has to be
// loaded even on a screen that renders no PoolTag.
import './PoolTag.css'
import { useT } from '../i18n'
import { POOL_COLORS, poolColorOf } from '../lib/poolColors'
import type { Pool, PoolColor } from '../lib/types'

type Props = {
  /** The pool whose colour is being chosen, or null while the dialog is closed. Looked up
   *  fresh by the parent, so a pool deleted mid-sync closes the dialog rather than leaving
   *  a picker with nothing to paint. */
  pool: Pool | null
  onPick: (color: PoolColor) => void
  /** Fired once the dialog has actually closed, whatever closed it. */
  onClose: () => void
}

/** Eight swatches. Picking one saves it and closes — a colour is not worth a Save button. */
export function PoolColorDialog({ pool, onPick, onClose }: Props) {
  const t = useT()
  const ref = useRef<HTMLDialogElement>(null)
  // A stable unique id, so the heading can name the dialog to a screen reader without a
  // hand-written constant that would collide if two dialogs were ever on the page.
  const titleId = useId()

  // A <dialog> keeps open/closed in the DOM rather than in React, so the state is pushed
  // into it here. Guarded both ways: showModal() on an open dialog throws.
  useEffect(() => {
    const dialog = ref.current
    if (dialog === null) return
    if (pool !== null && !dialog.open) dialog.showModal()
    if (pool === null && dialog.open) dialog.close()
  }, [pool])

  const current = pool === null ? null : poolColorOf(pool)

  return (
    <dialog className="dialog colors" ref={ref} aria-labelledby={titleId} onClose={onClose}>
      {pool !== null && (
        <>
          <h3 className="dialog__title" id={titleId}>
            {t.pools.colorTitle(pool.name)}
          </h3>

          <div className="colors__grid">
            {POOL_COLORS.map((color) => (
              <button
                key={color}
                className={`colors__swatch pool-tag--${color}`}
                type="button"
                // The name of the hue, not "swatch": a picker of eight identical labels is
                // unusable without sight of the colours.
                aria-label={t.pools.colorNames[color]}
                // `pressed`, not `selected`: this is a set of toggles where exactly one is
                // on, and pressed is the state a button can actually carry.
                aria-pressed={color === current}
                onClick={() => onPick(color)}
              >
                <span className="colors__dot" aria-hidden="true" />
              </button>
            ))}
          </div>

          <div className="dialog__actions">
            <button className="btn btn--ghost" type="button" onClick={() => ref.current?.close()}>
              {t.pools.colorDone}
            </button>
          </div>
        </>
      )}
    </dialog>
  )
}
