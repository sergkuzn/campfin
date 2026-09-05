/**
 * Scaling a money axis so the drawing is mostly data rather than mostly air.
 *
 * A chart library left to itself picks a round *step* first and lets the top follow, which
 * turns €430 of camp money into an axis that runs to €600 — a third of the plot empty.
 * Here the constraint is the other way round: find the smallest round step that still
 * reaches the data in a handful of intervals, then stop just above the data.
 *
 * Pure and in cents like the rest of `lib/`; the component only formats what comes back.
 */

/** A y-axis: where it ends and how far apart its labelled lines sit. */
export type AxisScale = {
  topCents: number
  stepCents: number
}

/** Round step sizes, as the leading digits of 1, 2, 2.5 or 5 times a power of ten — the
 *  numbers people read off an axis without doing arithmetic. */
const MANTISSAS = [1, 2, 2.5, 5]

/** More lines than this and the axis becomes a ladder; fewer steps than this and the top
 *  overshoots the data badly. Five or six gridlines is what a phone-sized chart carries. */
const MAX_INTERVALS = 6

/**
 * The lowest round top that covers `maxCents`, with the step it is a multiple of.
 *
 * Non-positive input (a camp with no money entered yet) gets a €1 axis: a flat zero line
 * still has to be drawn against something.
 */
export function niceAxisTop(maxCents: number): AxisScale {
  if (maxCents <= 0) return { topCents: 100, stepCents: 100 }

  // Start one power of ten below the data's own magnitude, so the search always begins
  // with a step that is too small and walks up to the first one that fits.
  const startExponent = Math.floor(Math.log10(maxCents)) - 1

  for (let exponent = startExponent; exponent <= startExponent + 3; exponent++) {
    for (const mantissa of MANTISSAS) {
      const stepCents = mantissa * 10 ** exponent
      // Cents are the smallest unit there is, so a fractional step cannot be labelled.
      if (!Number.isInteger(stepCents)) continue

      const intervals = Math.ceil(maxCents / stepCents)
      if (intervals <= MAX_INTERVALS) return { topCents: intervals * stepCents, stepCents }
    }
  }

  // Unreachable: a step of 10 × the data spans it in one interval. Kept so the function
  // has a total return type rather than an implicit undefined.
  return { topCents: maxCents, stepCents: maxCents }
}

/** The tick values of a scale, from zero to the top inclusive. */
export function axisTicks({ topCents, stepCents }: AxisScale): number[] {
  const ticks: number[] = []
  for (let value = 0; value <= topCents; value += stepCents) ticks.push(value)
  return ticks
}

/**
 * Every nth value of `values`, starting at the first, where n is the smallest stride that
 * fits the list into `maxLabels` slots.
 *
 * A chart library thins a crowded axis by walking it and dropping whatever collides with
 * the label before it, which spaces the survivors by their *width*: one-digit days all
 * fit, two-digit ones do not, and a fortnight comes out labelled 1…10, 12, 15. A fixed
 * stride spaces them by position instead, so the gaps read as regular even though the
 * last day may end up unlabelled.
 *
 * Generic over the value type: it selects by index and never looks inside an element, so
 * it works for the axis' label strings here and for numbers elsewhere. `maxLabels` below
 * one would divide by zero, so it is floored at one — a single label.
 */
export function spacedTicks<T>(values: T[], maxLabels: number): T[] {
  const stride = Math.ceil(values.length / Math.max(1, maxLabels))
  return values.filter((_, index) => index % stride === 0)
}
