/**
 * End-of-camp settlement: what was received, what was spent, what goes back.
 * Composes the budget helpers; kept separate so budget.ts stays a flat toolbox.
 */

import {
  fixedGrantTotalCents,
  passthroughTotalCents,
  perDiemBudgetCents,
  reservedRemainingCents,
  spentTotalCents,
} from './budget'
import type { Contribution, Expense, FixedGrantSource, IncomeSource, PerDiemBlock } from './types'

export type Settlement = {
  receivedTotalCents: number
  spentTotalCents: number
  /** The amount actually wired back. */
  toReturnCents: number
  /** By-behaviour split, rendered directly by the dashboard. */
  breakdown: {
    gradualBudgetCents: number
    gradualSpentCents: number
    gradualSlackCents: number
    reservedRemainingCents: number
    passthroughCents: number
  }
}

export function computeSettlement(
  sources: IncomeSource[],
  blocks: PerDiemBlock[],
  expenses: Expense[],
  contributions: Contribution[],
): Settlement {
  const gradualBudgetCents = perDiemBudgetCents(blocks) + fixedGrantTotalCents(sources, 'gradual')
  const reservedGrantCents = fixedGrantTotalCents(sources, 'reserved')
  const passthroughCents = passthroughTotalCents(contributions)

  const receivedTotalCents = gradualBudgetCents + reservedGrantCents + passthroughCents

  // Per-diem money is always gradual; a fixed grant only when its `use` says so;
  // pass-through money is forwarded, never spent.
  const gradualSourceIds = new Set<string>()
  for (const source of sources) {
    switch (source.kind) {
      case 'per_diem':
        gradualSourceIds.add(source.id)
        break
      case 'fixed':
        if (source.use === 'gradual') gradualSourceIds.add(source.id)
        break
      case 'passthrough':
        break
      default: {
        // Exhaustiveness guard: a new `kind` breaks the build here.
        const _never: never = source
        return _never
      }
    }
  }

  const gradualSpentCents = expenses
    .filter((e) => gradualSourceIds.has(e.sourceId))
    .reduce((sum, e) => sum + e.amountCents, 0)

  // Floored at 0: overspending returns nothing, not negative money.
  const gradualSlackCents = Math.max(0, gradualBudgetCents - gradualSpentCents)

  const reservedRemainingTotalCents = sources
    .filter((s): s is FixedGrantSource => s.kind === 'fixed' && s.use === 'reserved')
    .reduce((sum, s) => sum + reservedRemainingCents(s, expenses), 0)

  const toReturnCents = gradualSlackCents + reservedRemainingTotalCents + passthroughCents

  return {
    receivedTotalCents,
    spentTotalCents: spentTotalCents(expenses),
    toReturnCents,
    breakdown: {
      gradualBudgetCents,
      gradualSpentCents,
      gradualSlackCents,
      reservedRemainingCents: reservedRemainingTotalCents,
      passthroughCents,
    },
  }
}
