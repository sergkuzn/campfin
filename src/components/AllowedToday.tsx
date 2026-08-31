import './AllowedToday.css'
import { useFormat, useT } from '../i18n'
import type { Burn } from '../lib/burn'

type Props = {
  burn: Burn
  /** What is left in the everyday pool. Comes from the pool summary rather than from the
   *  curve, so this figure and the pool's bar can never show different numbers. */
  remainingCents: number
}

/** One labelled figure, rendered as two grid cells rather than a wrapping element: the
 *  table places every label in the grid's label column and every value in the grid's
 *  value column, so labels stay left and values line up flush right underneath each
 *  other. A local component because the table is four of the same thing and nothing
 *  outside this file needs the shape. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="allowed__stat-label">{label}</span>
      <span className="allowed__stat-value">{value}</span>
    </>
  )
}

/**
 * The headline: how much of the camp's money today may still consume, beside the four
 * numbers that put it in context — what today has cost so far, what a typical day costs,
 * and how many days and euros are left to spread over each other. Purely presentational;
 * every figure is computed elsewhere.
 */
export function AllowedToday({ burn, remainingCents }: Props) {
  const t = useT()
  const format = useFormat()

  const over = burn.allowedTodayCents < 0

  return (
    <div className="allowed">
      <div className="allowed__headline">
        <p className="allowed__label">{t.burn.allowedToday}</p>
        {/* An overspend is shown as a positive amount plus the word "over": a minus sign in
            front of a euro figure is easy to miss on a phone at a till. The word sits under
            the amount rather than after it, so going over grows the headline downwards
            instead of widening it and pushing the figures beside it onto their own line. */}
        <p className={over ? 'allowed__amount allowed__amount--over' : 'allowed__amount'}>
          {over ? format.euros(-burn.allowedTodayCents) : format.euros(burn.allowedTodayCents)}
        </p>
        {over && <p className="allowed__over">{t.burn.over}</p>}
      </div>
      {/* Filled row by row, so the left pair explains today's headline and the right pair
          says what the rest of the camp has to live on. Reading order stays the DOM order,
          which is also the order the pairs belong in. */}
      <div className="allowed__stats">
        <Stat label={t.burn.spentToday} value={format.euros(burn.spentTodayCents)} />
        <Stat label={t.burn.daysLeft} value={String(burn.remainingDays)} />
        <Stat label={t.burn.medianDay} value={format.euros(burn.medianDayCents)} />
        {/* Floored: an overspent pool has nothing left, and "−€8 left" is a riddle. The
            overspend itself is already shouted by the headline beside it. */}
        <Stat label={t.burn.moneyLeft} value={format.euros(Math.max(remainingCents, 0))} />
      </div>
    </div>
  )
}
