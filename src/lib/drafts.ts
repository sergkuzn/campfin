/**
 * The form boundary: persisted rows ⇄ editable strings. Euros exist on this side of
 * the line only; everything it hands back to the hook is integer cents.
 */

import { blockCents, blockPersonDays } from './budget'
import { parseEurosToCents } from './money'
import type { IncomeKind, IncomeSource, PerDiemBlock, PerDiemVariant, Pool } from './types'

/** Sentinel for the pool `<select>`'s "＋ New pool…" option. */
export const NEW_POOL = '__new__'

export type BlockDraft = {
  /** The persisted block's id, or null for a row the user just added. */
  id: string | null
  /** React list key. A brand-new row has no id yet but still needs a stable key —
   *  identity for rendering and identity for the database are different things. */
  key: string
  label: string
  persons: string
  startDate: string
  endDate: string
  rate: string // euros as typed
}

export type SourceDraft = {
  kind: IncomeKind
  name: string
  amount: string // euros as typed; unused when kind is 'per_diem'
  poolChoice: string // an existing pool id, or NEW_POOL
  newPoolName: string
  blocks: BlockDraft[] // per-diem only
}

/** What the hook needs to save a card. Ids and timestamps are minted there, not here. */
export type BlockInput = {
  id: string | null
  variant: PerDiemVariant
  label?: string
  numPersons: number
  ratePerPersonDayCents: number
  startDate: string
  endDate: string
}

export type SaveSourceInput = {
  /** The row being edited, or null when creating. Carries id + createdAt forward. */
  existing: IncomeSource | null
  campId: string
  kind: IncomeKind
  name: string
  amountCents: number | null // null for per-diem, whose amount is computed
  pool: { mode: 'existing'; poolId: string } | { mode: 'new'; name: string }
  blocks: BlockInput[]
}

/** An empty block row. `key` comes from the caller — lib stays free of crypto/Date. */
export function blankBlockDraft(key: string): BlockDraft {
  return { id: null, key, label: '', persons: '', startDate: '', endDate: '', rate: '' }
}

/** 1250 → "12,50" — the inverse of parseEurosToCents, for pre-filling an input. */
export function centsToEuroInput(cents: number): string {
  // Deliberately not formatEuros: its "2.125,00 €" has a thousands separator and a
  // currency sign, both of which the parser rejects on re-save.
  return (cents / 100).toFixed(2).replace('.', ',')
}

/** Seed the editor: an existing source becomes strings, a new one starts blank. */
export function draftFromSource(
  kind: IncomeKind,
  source: IncomeSource | null,
  blocks: PerDiemBlock[],
  defaultPool: Pool | undefined,
): SourceDraft {
  if (source === null) {
    return {
      kind,
      name: '',
      amount: '',
      poolChoice: defaultPool?.id ?? NEW_POOL,
      newPoolName: '',
      blocks: [],
    }
  }

  return {
    kind: source.kind,
    name: source.name,
    // A per-diem source has no stored amount at all — it is computed from its blocks.
    amount: source.kind === 'per_diem' ? '' : centsToEuroInput(source.amountCents),
    poolChoice: source.poolId,
    newPoolName: '',
    blocks: blocks.map((b) => ({
      id: b.id,
      key: b.id, // a persisted row's database id doubles as its render key
      label: b.label ?? '',
      persons: String(b.numPersons),
      startDate: b.startDate,
      endDate: b.endDate,
      rate: centsToEuroInput(b.ratePerPersonDayCents),
    })),
  }
}

/**
 * A validated block row, or null if it isn't ready. The variant belongs to the editing
 * session, not to the row — callers that only ask "is this row valid?" leave it at the
 * default.
 */
export function blockDraftToInput(
  draft: BlockDraft,
  variant: PerDiemVariant = 'granted',
): BlockInput | null {
  const numPersons = Number(draft.persons)
  if (draft.persons.trim() === '' || !Number.isInteger(numPersons) || numPersons <= 0) return null

  const ratePerPersonDayCents = parseEurosToCents(draft.rate)
  if (ratePerPersonDayCents === null || ratePerPersonDayCents <= 0) return null

  // ISO dates compare correctly as plain strings — lexicographic order is chronological,
  // so no Date object is needed.
  if (draft.startDate === '' || draft.endDate === '' || draft.startDate > draft.endDate) return null

  const label = draft.label.trim()
  return {
    id: draft.id,
    variant,
    label: label === '' ? undefined : label, // an omitted optional field is undefined, not ''
    numPersons,
    ratePerPersonDayCents,
    startDate: draft.startDate,
    endDate: draft.endDate,
  }
}

/**
 * People × inclusive days for a half-typed row, or null while people or dates are
 * unusable. Deliberately ignores the rate: the person-day count is the quantity the
 * user is checking, and it should appear as soon as the dates are in.
 */
export function blockDraftPersonDays(draft: BlockDraft): number | null {
  const numPersons = Number(draft.persons)
  if (draft.persons.trim() === '' || !Number.isInteger(numPersons) || numPersons <= 0) return null
  if (draft.startDate === '' || draft.endDate === '' || draft.startDate > draft.endDate) return null
  return blockPersonDays(numPersons, draft.startDate, draft.endDate)
}

/** Σ person-days over the rows that have one; rows still being typed count as 0. */
export function draftPersonDays(blocks: BlockDraft[]): number {
  return blocks.reduce((sum, block) => sum + (blockDraftPersonDays(block) ?? 0), 0)
}

/** What a half-typed block row is worth, or null while it isn't valid yet. */
export function blockDraftCents(draft: BlockDraft): number | null {
  const input = blockDraftToInput(draft)
  if (input === null) return null
  return blockCents(input.numPersons, input.ratePerPersonDayCents, input.startDate, input.endDate)
}

/**
 * What is wrong with the draft, as *codes* rather than sentences: `lib/` must not know
 * which language the UI speaks, so the dictionary turns each code into text. A typo in a
 * code is a compile error, which a free-text string could never be.
 */
export type DraftIssue = 'name' | 'poolName' | 'noBlocks' | 'invalidBlock' | 'amount'

/** Problems with the draft. Empty array = Save is allowed. */
export function draftIssues(draft: SourceDraft): DraftIssue[] {
  const issues: DraftIssue[] = []

  if (draft.name.trim() === '') issues.push('name')
  if (draft.poolChoice === NEW_POOL && draft.newPoolName.trim() === '') {
    issues.push('poolName')
  }

  if (draft.kind === 'per_diem') {
    if (draft.blocks.length === 0) {
      issues.push('noBlocks')
    } else if (draft.blocks.some((b) => blockDraftToInput(b) === null)) {
      issues.push('invalidBlock')
    }
  } else {
    const cents = parseEurosToCents(draft.amount)
    if (cents === null || cents <= 0) issues.push('amount')
  }

  return issues
}

/** The draft as a save payload, or null when `draftIssues` isn't empty. */
export function draftToInput(
  draft: SourceDraft,
  campId: string,
  existing: IncomeSource | null,
  variant: PerDiemVariant = 'granted',
): SaveSourceInput | null {
  // One gate: a caller cannot smuggle an invalid draft past validation by calling
  // this directly instead of checking draftIssues first.
  if (draftIssues(draft).length > 0) return null

  const isPerDiem = draft.kind === 'per_diem'
  // `filter(input => input !== null)` would still be (BlockInput | null)[] to the
  // compiler; mapping and then narrowing keeps the array honestly typed.
  const blocks: BlockInput[] = []
  if (isPerDiem) {
    for (const block of draft.blocks) {
      const input = blockDraftToInput(block, variant)
      if (input !== null) blocks.push(input)
    }
  }

  return {
    existing,
    campId,
    kind: draft.kind,
    name: draft.name.trim(),
    amountCents: isPerDiem ? null : parseEurosToCents(draft.amount),
    pool:
      draft.poolChoice === NEW_POOL
        ? { mode: 'new', name: draft.newPoolName.trim() }
        : { mode: 'existing', poolId: draft.poolChoice },
    blocks,
  }
}
