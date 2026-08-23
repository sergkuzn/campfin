import type { ReactNode } from 'react'

type Props = {
  /** The screen's own block class — "receipts", "report" — carried alongside the global
   *  frame, so a screen can still style what is genuinely local to it. */
  name: string
  /** The way back out, on the screens that have one. A screen reached from nowhere (the
   *  camp list) leaves it off. */
  back?: {
    label: string
    onClick: () => void
    /** Extra classes for the button itself, for the one screen that needs more than the
     *  shared shape — the report hides its back button from the printed page. */
    className?: string
  }
  children: ReactNode
}

/**
 * The frame every screen opens with: the single full-width column and, above it, the way
 * back out. One component so the eight screens cannot drift apart in either.
 *
 * The header stays with each screen rather than moving in here — a title alone, a title
 * with an Add button, a title with a status pill: they differ enough that a prop for each
 * would be longer than the markup it replaced.
 */
export function Screen({ name, back, children }: Props) {
  return (
    <div className={`screen ${name}`}>
      {back !== undefined && (
        <button
          className={back.className === undefined ? 'screen-back' : `screen-back ${back.className}`}
          type="button"
          onClick={back.onClick}
        >
          {back.label}
        </button>
      )}
      {children}
    </div>
  )
}
