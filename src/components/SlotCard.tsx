import type { ReactNode } from 'react'
import './SlotCard.css'

/**
 * The app's one card shape: a bordered box with a tinted title band across its top.
 *
 * Two flavours, because a card either leads somewhere or it doesn't:
 *
 * - `SlotCard` is a <button>, so a thumb aiming anywhere on it hits the destination.
 *   Nothing inside may be interactive — that is what keeps one focusable element per card.
 * - `SlotPanel` is a plain <section> in the same clothes, for a card that holds its own
 *   controls (a text field, a Save button) and therefore cannot be one big button.
 */

/** Solid border and surface once the card holds real content rather than a placeholder. */
function cardClass(filled: boolean, extra?: string): string {
  return ['slot-card', filled ? 'slot-card--filled' : null, extra ?? null]
    .filter((part) => part !== null)
    .join(' ')
}

export function SlotCard({
  title,
  /** Never drawn: it is what a screen reader reads after the title, since the chevron
   *  alone says nothing about where the card leads. */
  action,
  onOpen,
  filled,
  children,
}: {
  title: string
  action: string
  onOpen: () => void
  filled: boolean
  children: ReactNode
}) {
  return (
    <button className={cardClass(filled)} type="button" onClick={onOpen}>
      <div className="slot-card__head">
        <span className="slot-card__title">{title}</span>
        <span className="visually-hidden">{action}</span>
        <span className="slot-card__chevron" aria-hidden="true">
          ›
        </span>
      </div>
      {children}
    </button>
  )
}

export function SlotPanel({
  title,
  className,
  children,
}: {
  title: string
  /** For a panel that needs its own frame on top of the shared one — the danger zone. */
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cardClass(true, className)}>
      <div className="slot-card__head">
        <h3 className="slot-card__title">{title}</h3>
      </div>
      {children}
    </section>
  )
}
