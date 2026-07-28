/**
 * Persistence for the three income namespaces. One localStorage key per row type,
 * mirroring how InstantDB stores namespaces — milestone 7 replaces the bodies here
 * and nothing above this file changes.
 */

import { type IncomeState, isContribution, isIncomeSource, isPerDiemBlock } from '../lib/income'
import { loadCollection, saveCollection } from './storage'

const SOURCES_KEY = 'campfin.sources.v1'
const BLOCKS_KEY = 'campfin.blocks.v1'
const CONTRIBUTIONS_KEY = 'campfin.contributions.v1'

export function loadIncome(): IncomeState {
  return {
    sources: loadCollection(SOURCES_KEY, isIncomeSource),
    blocks: loadCollection(BLOCKS_KEY, isPerDiemBlock),
    contributions: loadCollection(CONTRIBUTIONS_KEY, isContribution),
  }
}

export function saveIncome(state: IncomeState): void {
  saveCollection(SOURCES_KEY, state.sources)
  saveCollection(BLOCKS_KEY, state.blocks)
  saveCollection(CONTRIBUTIONS_KEY, state.contributions)
}
