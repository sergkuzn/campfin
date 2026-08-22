/**
 * The form boundary: persisted rows ⇄ editable strings. Euros exist on this side of
 * the line only; everything it hands back to the hook is integer cents.
 */

import { blockCents, blockPersonDays } from './budget'
import { parseEurosToCents } from './money'
import type {
  CreatablePoolRole,
  IncomeKind,
  IncomeSource,
  PerDiemBlock,
  PerDiemVariant,
} from './types'

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
  /** Blank means "named by its pool" — only asked for at all when `kindNeedsName`. */
  name: string
  amount: string // euros as typed; unused when kind is 'per_diem'
  blocks: BlockDraft[] // per-diem only
}

/** The "＋ Add pool" form. Colour is not here: a new pool is given the first free hue. */
export type PoolDraft = {
  name: string
  role: CreatablePoolRole
}

/**
 * Which incomes are worth naming separately. A per-diem grant is the camp's spine and a
 * deposit is its pool's whole reason to exist, so both borrow the pool's name; only a
 * fixed grant can end up beside a sibling it has to be told apart from.
 */
export function kindNeedsName(kind: IncomeKind): boolean {
  return kind === 'fixed'
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

/**
 * What the hook needs to replace one variant's block rows — the actual-attendance editor,
 * which touches no name, amount or pool. Separate from `SaveSourceInput` so saving "who
 * really came" cannot accidentally rewrite the grant it is compared against.
 */
export type SaveBlocksInput = {
  campId: string
  sourceId: string
  variant: PerDiemVariant
  blocks: BlockInput[]
}

export type SaveSourceInput = {
  /** The row being edited, or null when creating. Carries id + createdAt forward. */
  existing: IncomeSource | null
  campId: string
  /** The pool the form was opened inside. Income is always added to a pool that exists. */
  poolId: string
  kind: IncomeKind
  /** null clears the stored name, which makes the income fall back to its pool's. */
  name: string | null
  amountCents: number | null // null for per-diem, whose amount is computed
  blocks: BlockInput[]
}

/** What the hook needs to create a pool. Pools are made deliberately now, not as a
 *  side effect of saving the first income into them. */
export type SavePoolInput = {
  campId: string
  name: string
  role: CreatablePoolRole
}

/** An empty block row. `key` comes from the caller — lib stays free of crypto/Date. */
export function blankBlockDraft(key: string): BlockDraft {
  return { id: null, key, label: '', persons: '', startDate: '', endDate: '', rate: '' }
}

/** A new row seeded from `source`'s fields — same name, people, rate and dates, so a
 *  follow-up block that only changes one thing (a headcount drop, a later start) begins
 *  from something real instead of blank. `id: null` makes it a row of its own to save. */
export function copyBlockDraft(source: BlockDraft, key: string): BlockDraft {
  return { ...source, id: null, key }
}

/** 1250 → "8,00" — the inverse of parseEurosToCents, for pre-filling an input. */
export function centsToEuroInput(cents: number): string {
  // Deliberately not formatEuros: its "2.125,00 €" has a thousands separator and a
  // currency sign, both of which the parser rejects on re-save.
  return (cents / 100).toFixed(2).replace('.', ',')
}

/** Persisted blocks as editable rows: each keeps its id, so saving updates it in place. */
export function draftsFromBlocks(blocks: PerDiemBlock[]): BlockDraft[] {
  return blocks.map((b) => ({
    id: b.id,
    key: b.id, // a persisted row's database id doubles as its render key
    label: b.label ?? '',
    persons: String(b.numPersons),
    startDate: b.startDate,
    endDate: b.endDate,
    rate: centsToEuroInput(b.ratePerPersonDayCents),
  }))
}

/**
 * "Copy from granted": the same rows, but as *new* ones — `id: null`, so saving creates
 * actual blocks beside the granted ones instead of moving them. `newKey` is injected
 * because `lib/` may not reach for `crypto.randomUUID`.
 */
export function copyDraftsFromBlocks(blocks: PerDiemBlock[], newKey: () => string): BlockDraft[] {
  return draftsFromBlocks(blocks).map((draft) => ({ ...draft, id: null, key: newKey() }))
}

/** Seed the editor: an existing source becomes strings, a new one starts blank. */
export function draftFromSource(
  kind: IncomeKind,
  source: IncomeSource | null,
  blocks: PerDiemBlock[],
): SourceDraft {
  if (source === null) return { kind, name: '', amount: '', blocks: [] }

  return {
    kind: source.kind,
    name: source.name ?? '',
    // A per-diem source has no stored amount at all — it is computed from its blocks.
    amount: source.kind === 'per_diem' ? '' : centsToEuroInput(source.amountCents),
    blocks: draftsFromBlocks(blocks),
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
export type DraftIssue = 'poolName' | 'noBlocks' | 'invalidBlock' | 'amount'

/**
 * Problems with the draft. Empty array = Save is allowed.
 *
 * A blank name is deliberately not a problem: an unnamed income inherits its pool's name,
 * which is the whole point of not asking for one twice.
 */
export function draftIssues(draft: SourceDraft): DraftIssue[] {
  const issues: DraftIssue[] = []

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

/** A pool needs a name — it is the one name the pool and its only income share. */
export function poolDraftIssues(draft: PoolDraft): DraftIssue[] {
  return draft.name.trim() === '' ? ['poolName'] : []
}

/** The pool form as a save payload, or null while it isn't valid. */
export function poolDraftToInput(draft: PoolDraft, campId: string): SavePoolInput | null {
  if (poolDraftIssues(draft).length > 0) return null
  return { campId, name: draft.name.trim(), role: draft.role }
}

/**
 * What is wrong with a bare list of block rows — the actual-attendance editor. An *empty*
 * list is deliberately fine: no actual blocks means actual is granted, so clearing the
 * editor is how you say "everybody came after all".
 */
export function blockDraftsIssues(drafts: BlockDraft[]): DraftIssue[] {
  return drafts.some((d) => blockDraftToInput(d) === null) ? ['invalidBlock'] : []
}

/** A block list as a save payload, or null while any row is half typed. */
export function blockDraftsToInput(
  drafts: BlockDraft[],
  campId: string,
  sourceId: string,
  variant: PerDiemVariant,
): SaveBlocksInput | null {
  if (blockDraftsIssues(drafts).length > 0) return null

  const blocks: BlockInput[] = []
  for (const draft of drafts) {
    const input = blockDraftToInput(draft, variant)
    if (input !== null) blocks.push(input)
  }
  return { campId, sourceId, variant, blocks }
}

/** The draft as a save payload, or null when `draftIssues` isn't empty. */
export function draftToInput(
  draft: SourceDraft,
  campId: string,
  poolId: string,
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

  // A name is only kept for the kinds that are asked for one, and only when it is not
  // blank: a kind that borrows its pool's name must never carry a stale copy of its own.
  const name = draft.name.trim()

  return {
    existing,
    campId,
    poolId,
    kind: draft.kind,
    name: kindNeedsName(draft.kind) && name !== '' ? name : null,
    amountCents: isPerDiem ? null : parseEurosToCents(draft.amount),
    blocks,
  }
}
