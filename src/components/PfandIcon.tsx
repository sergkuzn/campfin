import './PfandIcon.css'

type Props = {
  /** The variant class that sizes it for where it lands — "pfand-icon--tall" on a button,
   *  "pfand-icon--title" beside a heading. The base class is always applied, so a caller
   *  cannot leave the mark unsized. */
  className?: string
}

/**
 * The pfand mark: a bottle in a crate, with the arrow that takes it back to the shop.
 *
 * Inline SVG rather than an image file, for the same reasons as the theme toggle's glyphs:
 * it draws in `currentColor`, so it recolours with the theme and with whatever button it
 * sits on, and it ships in the bundle — no second request, no frame where the icon is
 * missing on a cold load.
 *
 * Two tones without two colours: the crate and the arrow take the full ink, the bottle a
 * faded pass of the same. A second hard-coded colour would have to be contrast-checked
 * against both palettes, while a fade of the surrounding text colour cannot fall below it.
 *
 * `aria-hidden` throughout — every place it appears already carries a visible label, and a
 * screen reader announcing the picture too would say the same word twice.
 */
export function PfandIcon({ className }: Props) {
  return (
    <svg
      className={className === undefined ? 'pfand-icon' : `pfand-icon ${className}`}
      viewBox="0 30 185 192"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {/* The crate: four corners, drawn as two wedges above and two blocks below. They only
          have to say "crate" around the bottle, so they are kept small and pulled in to the
          bottle and the arrow — the viewBox crops to what is left, which is why it starts at
          y=30 rather than at the origin. */}
      <path d="M0 30h45L0 75z" />
      <path d="M185 30h-45l45 45z" />
      <rect x="0" y="198" width="24" height="24" />
      <rect x="161" y="198" width="24" height="24" />

      {/* The bottle, upright in the crate: body, then neck and cap. */}
      <g fillOpacity="0.6">
        <path d="M95 90c6.48-.08 7.39 1.3 8 5v50h12c4.13-.37 8.42-.37 10-7V80c-.59-6.33-1.45-13.02-10-30-.65-1.09-.63-2.12 0-3l1-1v-7h-13v7l1 1c.65 1.1.74 1.81 0 3-5.1 8.1-8.19 18.36-10 30v9c.14.73.61.78 1 1z" />
        <path d="M67 100v46c.82 3.33 4.7 5.28 6.95 5.01h16.08c2.13-.16 6.23-2.01 5.97-6.01v-45l-3-5H70l-3 5z" />
      </g>

      {/* The return arrow, curving out of the crate and back to the left. */}
      <path d="M131 111v16.01l14-.001c15 .007 14.99 31.003 0 30.997H45v-18l-31 26 31 26v-17h100c14.99-.003 28-15 28-30 0-19.993-13-33.995-28-34h-14z" />
    </svg>
  )
}
