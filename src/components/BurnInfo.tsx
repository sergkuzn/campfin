import './BurnInfo.css'
import { useState } from 'react'
import { useT } from '../i18n'
import { InfoToggle } from './InfoToggle'

type Props = {
  /** Whether to offer the ⓘ at all. False before the camp has a daily grant: the card
   *  then shows the setup callout, and neither figure the text explains is on screen. */
  showToggle: boolean
}

/**
 * The burn card's title, the ⓘ beside it and the explainer it unfolds.
 *
 * Title and disclosure live in one component because they are two siblings that only make
 * sense together — the button sits in the title row, the text it controls lands under it,
 * and the open/closed state belongs to neither the dashboard nor the chart.
 */
export function BurnInfo({ showToggle }: Props) {
  // Folded by default: the explanation is worth one read, not one per visit to the camp.
  const [open, setOpen] = useState(false)
  const t = useT()

  return (
    <>
      <div className="burn-info__head">
        <p className="slot-card__title">{t.burn.title}</p>
        {showToggle && (
          <InfoToggle
            label={t.burn.aboutLabel}
            open={open}
            controls="burn-about"
            onToggle={() => setOpen((shown) => !shown)}
          />
        )}
      </div>

      {open && (
        <ul className="burn-info__hint" id="burn-about">
          {t.burn.about.map((entry) => (
            <li key={entry.text}>
              {entry.text}
              {/* A nested <ul> rather than more top-level bullets: the sub-points are two
                  facts about the term above them, and the indent is what says so. */}
              {entry.sub.length > 0 && (
                <ul>
                  {entry.sub.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
