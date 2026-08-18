import './PoolTag.css'
import { poolColorOf } from '../lib/poolColors'
import type { Pool } from '../lib/types'

type Props = {
  pool: Pool
  /** `dot` is a coloured mark before a name the caller renders; `chip` is the whole name
   *  in a tinted pill, for places where the pool is the row's own label. */
  variant?: 'dot' | 'chip'
}

/**
 * A pool, wearing its colour. One component for every place a pool is named, so the same
 * pot looks the same on a receipt row, in a filter chip and above its bar.
 *
 * The colour is a class, not an inline style: the palette then lives in one stylesheet
 * with a light and a dark value per hue, instead of a hex code compiled into the bundle.
 */
export function PoolTag({ pool, variant = 'chip' }: Props) {
  const color = poolColorOf(pool)

  if (variant === 'dot') {
    // Decorative: the name it sits next to is already the accessible label, and a screen
    // reader announcing "blue" adds nothing a leader can act on.
    return <span className={`pool-tag__dot pool-tag--${color}`} aria-hidden="true" />
  }

  return (
    <span className={`pool-tag pool-tag--${color}`}>
      <span className="pool-tag__dot" aria-hidden="true" />
      {pool.name}
    </span>
  )
}
