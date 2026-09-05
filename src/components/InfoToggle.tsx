type Props = {
  /** Accessible name — the ⓘ says nothing a screen reader could use. Phrase it as the
   *  question the folded text answers. */
  label: string
  /** Whether the text it controls is showing. The state lives with the caller, because the
   *  caller is what decides where that text lands on the page. */
  open: boolean
  /** The id of the element holding that text. The caller renders it, so it owns the id. */
  controls: string
  onToggle: () => void
}

/**
 * The ⓘ that unfolds a sentence explaining what a screen or a control is for.
 *
 * A *disclosure*, not a tooltip: `aria-expanded` and `aria-controls` are what make a screen
 * reader announce both what the button opens and whether it is open right now — and unlike a
 * hover tooltip it works on a phone, which is the only place this app runs.
 *
 * Only the button lives here. The text it reveals is rendered by the caller, so the same
 * control can sit beside a heading on one screen and beside a checkbox on another without
 * this component having an opinion about the layout. It wears `.info-button` from the
 * shell's stylesheet, so every ⓘ in the app is the same size wherever it appears.
 */
export function InfoToggle({ label, open, controls, onToggle }: Props) {
  return (
    <button
      className="info-button"
      type="button"
      aria-label={label}
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
    >
      ⓘ
    </button>
  )
}
