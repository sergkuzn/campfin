/**
 * Which colour a pool is drawn in. Pure: this module decides *which* token a pool carries,
 * never what the token looks like — the values live in `PoolTag.css` so each hue can have
 * a light and a dark variant.
 *
 * Two rules, and both exist to keep colour useful rather than decorative:
 * - a pool without a stored colour still gets a stable one, derived from its id, so pools
 *   created before this existed already look distinct with nothing written to them;
 * - a new pool takes the first hue no sibling is using, so two pools side by side collide
 *   only once the palette is exhausted.
 */

import type { Pool, PoolColor } from './types'

/** Every hue a pool can take, in the order the picker shows them and new pools claim them. */
export const POOL_COLORS: readonly PoolColor[] = [
  'blue',
  'teal',
  'green',
  'amber',
  'orange',
  'rose',
  'violet',
  'slate',
]

export function isPoolColor(value: unknown): value is PoolColor {
  return typeof value === 'string' && (POOL_COLORS as readonly string[]).includes(value)
}

/**
 * A small stable hash of the id. Not cryptography — it only has to spread ids across the
 * palette and give the same answer on both phones, which any deterministic sum does.
 */
function hashCode(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    // `| 0` keeps the running value a 32-bit integer, so long ids cannot drift into the
    // float range where two different ids could round to the same number.
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

/** The colour to draw this pool in: what was chosen, or a stable fallback from its id. */
export function poolColorOf(pool: Pool): PoolColor {
  if (pool.color !== undefined) return pool.color
  // Non-null: POOL_COLORS is a non-empty literal list, but the compiler only knows it as an
  // array, so the fallback keeps the return type PoolColor rather than PoolColor | undefined.
  return POOL_COLORS[hashCode(pool.id) % POOL_COLORS.length] ?? 'blue'
}

/**
 * The colour to give a pool being created: the first one none of the camp's existing pools
 * is showing. Once every hue is taken it starts over at the front — a repeat is better
 * than a colourless pool.
 */
export function nextPoolColor(pools: Pool[]): PoolColor {
  // Compares against the *displayed* colour, so an old pool still falling back to its
  // id-derived hue is not handed the same one twice.
  const taken = new Set(pools.map(poolColorOf))
  return (
    POOL_COLORS.find((color) => !taken.has(color)) ??
    POOL_COLORS[pools.length % POOL_COLORS.length] ??
    'blue'
  )
}
