import type { IncomeKind } from '../lib/types'

export type IncomeTypeOption = {
  kind: IncomeKind
  label: string
  hint: string
  /** false → this kind always gets a pool of its own (mixing it would be a bug). */
  allowExistingPool: boolean
}

export const INCOME_TYPES: IncomeTypeOption[] = [
  {
    kind: 'per_diem',
    label: 'Per person, per day',
    hint: 'Verpflegungspauschale — people × days × rate',
    allowExistingPool: true,
  },
  {
    kind: 'fixed',
    label: 'Fixed amount',
    hint: 'One lump sum for the camp',
    allowExistingPool: true,
  },
  {
    kind: 'deposit',
    label: 'Deposit',
    hint: 'You hand it back at the end',
    allowExistingPool: false,
  },
]

export function incomeType(kind: IncomeKind): IncomeTypeOption {
  // `find` can return undefined; the non-null assertion would be a lie waiting to
  // happen, so fail loudly instead — an unknown kind is a bug, not a user error.
  const option = INCOME_TYPES.find((t) => t.kind === kind)
  if (option === undefined) throw new Error(`Unknown income kind: ${kind}`)
  return option
}
