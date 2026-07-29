/**
 * Persistence for the income namespaces. One localStorage key per row type, mirroring
 * how InstantDB stores namespaces — stage 07 replaces the bodies here and nothing above
 * this file changes.
 */

import {
  type IncomeState,
  isIncomeSource,
  isLegacyBlock,
  isLegacyPool,
  isPerDiemBlock,
  isPool,
  upgradeBlocks,
  upgradePools,
} from '../lib/income'
import { loadCollection, saveCollection } from './storage'

// v3: pools gained `role` and blocks gained `variant`, both required. Sources are
// unchanged but move along with them so one version number describes the whole set.
const POOLS_KEY = 'campfin.pools.v3'
const SOURCES_KEY = 'campfin.sources.v3'
const BLOCKS_KEY = 'campfin.blocks.v3'

// The keys the previous build wrote. Read once, upgraded, then never touched again.
const POOLS_KEY_V2 = 'campfin.pools.v1'
const SOURCES_KEY_V2 = 'campfin.sources.v2'
const BLOCKS_KEY_V2 = 'campfin.blocks.v2'

/** Reading storage can throw outright (Safari private mode), not just return null. */
function hasKey(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null
  } catch {
    return false
  }
}

export function loadIncome(): IncomeState {
  // A v3 write always writes all three keys, so the pools key alone decides. Bumping the
  // keys without this would silently discard the camp's income rather than migrate it.
  if (!hasKey(POOLS_KEY)) {
    const migrated = migrateFromV2()
    if (migrated !== null) {
      saveIncome(migrated)
      return migrated
    }
  }

  return {
    pools: loadCollection(POOLS_KEY, isPool),
    sources: loadCollection(SOURCES_KEY, isIncomeSource),
    blocks: loadCollection(BLOCKS_KEY, isPerDiemBlock),
  }
}

export function saveIncome(state: IncomeState): void {
  saveCollection(POOLS_KEY, state.pools)
  saveCollection(SOURCES_KEY, state.sources)
  saveCollection(BLOCKS_KEY, state.blocks)
}

/**
 * v2 rows read with the lenient guards and given their new fields, or null when there
 * was nothing to migrate. The v2 keys are left in place — they cost a few kilobytes and
 * are the only copy of the old data if the upgrade turns out to be wrong.
 */
function migrateFromV2(): IncomeState | null {
  const pools = loadCollection(POOLS_KEY_V2, isLegacyPool)
  const sources = loadCollection(SOURCES_KEY_V2, isIncomeSource)
  const blocks = loadCollection(BLOCKS_KEY_V2, isLegacyBlock)
  if (pools.length === 0 && sources.length === 0 && blocks.length === 0) return null

  return {
    pools: upgradePools(pools, sources),
    sources,
    blocks: upgradeBlocks(blocks),
  }
}
