import './AllowedToday.css'
import { useFormat, useT } from '../i18n'
import type { Burn } from '../lib/burn'

type Props = {
  burn: Burn
}

/**
 * The headline: how much of the camp's money today may still consume, with the two
 * quieter numbers that make it explicable. Purely presentational — every figure is
 * already computed by `computeBurn`.
 */
export function AllowedToday({ burn }: Props) {
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
      <p className="allowed__companions">
        <span>{t.burn.spentToday(format.euros(burn.spentTodayCents))}</span>
        <span>{t.burn.normalDay(format.euros(burn.normalDayCents))}</span>
      </p>
    </div>
  )
}
