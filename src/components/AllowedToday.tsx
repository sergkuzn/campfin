import './AllowedToday.css'
import { useFormat, useT } from '../i18n'
import type { Burn } from '../lib/burn'

type Props = {
  burn: Burn
  /** What is left in the everyday pool. Comes from the pool summary rather than from the
   *  curve, so this figure and the pool's bar can never show different numbers. */
  remainingCents: number
}

/** One labelled figure, label and value on the same line. A local component because the
 *  row is four of the same thing and nothing outside this file needs the shape. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="allowed__stat">
      <span className="allowed__stat-label">{label}</span>
      <span className="allowed__stat-value">{value}</span>
    </span>
  )
}

/**
 * The headline: how much of the camp's money today may still consume, over the four
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
      <p className="allowed__label">{t.burn.allowedToday}</p>
      {/* An overspend is shown as a positive amount plus the word "over": a minus sign in
          front of a euro figure is easy to miss on a phone at a till. */}
      <p className={over ? 'allowed__amount allowed__amount--over' : 'allowed__amount'}>
        {over
          ? t.burn.overspentBy(format.euros(-burn.allowedTodayCents))
          : format.euros(burn.allowedTodayCents)}
      </p>
      {/* Two groups rather than four loose figures: the first pair explains today's
          headline, the second says what the rest of the camp has to live on. Each group
          holds together on one line and only the groups wrap against each other. */}
      <div className="allowed__stats">
        <span className="allowed__group">
          <Stat label={t.burn.spentToday} value={format.euros(burn.spentTodayCents)} />
          <Stat label={t.burn.medianDay} value={format.euros(burn.medianDayCents)} />
        </span>
        <span className="allowed__group">
          <Stat label={t.burn.daysLeft} value={String(burn.remainingDays)} />
          {/* Floored: an overspent pool has nothing left, and "−€8 left" is a riddle. The
              overspend itself is already shouted by the headline above. */}
          <Stat label={t.burn.moneyLeft} value={format.euros(Math.max(remainingCents, 0))} />
        </span>
      </div>
    </div>
  )
}
