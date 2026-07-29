/**
 * Persistence for the income namespaces. One localStorage key per row type, mirroring
 * how InstantDB stores namespaces — milestone 4 replaces the bodies here and nothing
 * above this file changes.
 */

import { type IncomeState, isIncomeSource, isPerDiemBlock, isPool } from '../lib/income'
import { loadCollection, saveCollection } from './storage'

// v2: sources gained poolId and lost `use`, so v1 rows are a different shape. The type
// guards would drop them one by one anyway; a new key makes the break explicit.
const POOLS_KEY = 'campfin.pools.v1'
const SOURCES_KEY = 'campfin.sources.v2'
const BLOCKS_KEY = 'campfin.blocks.v2'

export function loadIncome(): IncomeState {
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
