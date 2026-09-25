import { type ReactNode, useState } from 'react'
import './SlotCard.css'
import { InfoToggle } from './InfoToggle'

/**
 * The app's one card shape: a bordered box with a tinted title band across its top.
 *
 * Two flavours, because a card either leads somewhere or it doesn't:
 *
 * - `SlotCard` is a <button>, so a thumb aiming anywhere on it hits the destination.
 *   Nothing inside may be interactive — that is what keeps one focusable element per card.
 * - `SlotPanel` is a plain <section> in the same clothes, for a card that holds its own
 *   controls (a text field, a Save button) and therefore cannot be one big button.
 *
 * A `SlotCard` handed a `toggle` becomes the second shape for as long as it has one: a
 * <section> whose only control is that toggle. A button nested inside a button is invalid
 * HTML — the browser drops the inner one — so the card stops leading anywhere while it is
 * being configured, rather than trying to do both at once.
 */

/** Solid border and surface once the card holds real content rather than a placeholder. */
function cardClass(filled: boolean, extra?: string): string {
  return ['slot-card', filled ? 'slot-card--filled' : null, extra ?? null]
    .filter((part) => part !== null)
    .join(' ')
}

/** Turns a card from a destination into something to show or hide. */
export type SlotToggle = {
  /** Whether the card is currently left out of the dashboard. Marks the card when true. */
  hidden: boolean
  /** The word on the button: "Hide" or "Show". The card's title sits right beside it. */
  label: string
  /** The button's accessible name — "Hide deposits". A screen reader reaches the button on
   *  its own, where the verb alone would not say which card it acts on. */
  name: string
  onToggle: () => void
}

export function SlotCard({
  title,
  /** Never drawn: it is what a screen reader reads after the title, since the chevron
   *  alone says nothing about where the card leads. */
  action,
  onOpen,
  filled,
  toggle,
  children,
}: {
  title: string
  action: string
  onOpen: () => void
  filled: boolean
  /** Present only while the group is being customised; the card is inert then. */
  toggle?: SlotToggle
  children: ReactNode
}) {
  if (toggle !== undefined) {
    return (
      <section className={cardClass(filled, toggle.hidden ? 'slot-card--dimmed' : undefined)}>
        <div className="slot-card__head">
          <span className="slot-card__title">{title}</span>
          <button
            className={
              toggle.hidden ? 'slot-card__toggle slot-card__toggle--show' : 'slot-card__toggle'
            }
            type="button"
            aria-label={toggle.name}
            onClick={toggle.onToggle}
          >
            {toggle.label}
          </button>
        </div>
        {children}
      </section>
    )
  }

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

/** An ⓘ beside a panel's title, and the sentence it unfolds under the title band. */
export type SlotInfo = {
  /** The button's accessible name, phrased as the question the text answers. */
  label: string
  text: string
  /** Ties the button to the text it reveals; unique on the page. */
  id: string
}

export function SlotPanel({
  title,
  info,
  className,
  children,
}: {
  title: string
  info?: SlotInfo
  /** For a panel that needs its own frame on top of the shared one — the danger zone. */
  className?: string
  children: ReactNode
}) {
  // Folded by default, like every other ⓘ: the explanation is worth one read, not one per
  // visit. The panel owns the state because nothing outside it cares whether it is open.
  const [infoOpen, setInfoOpen] = useState(false)

  return (
    <section className={cardClass(true, className)}>
      <div className="slot-card__head">
        {/* The ⓘ sits right after the title rather than out at the band's edge, so the two
            read as one label with a question attached. */}
        <div className="slot-card__title-row">
          <h3 className="slot-card__title">{title}</h3>
          {info !== undefined && (
            <InfoToggle
              label={info.label}
              open={infoOpen}
              controls={info.id}
              onToggle={() => setInfoOpen((shown) => !shown)}
            />
          )}
        </div>
      </div>
      {info !== undefined && infoOpen && (
        <p className="slot-card__hint slot-card__info" id={info.id}>
          {info.text}
        </p>
      )}
      {children}
    </section>
  )
}
