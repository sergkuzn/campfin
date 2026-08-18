/**
 * Cash custody: a Kaution handed to a shop and returned by them, and volunteers' money
 * you are holding for the organisation. None of it consumes budget — that is the whole
 * distinction from an `Expense`, and it is what keeps the burn curve honest.
 *
 * Pure: the row guard lives in `income.ts` (`isMovement`), the clock arrives as an
 * argument, and nothing here knows which language the UI speaks.
 */

import { parseEurosToCents } from './money'
import { depositPools, type PoolSummary } from './pools'
import type { DepositMovement, Movement, MovementKind, Pool } from './types'

/** Menu order of the movement kinds. Labels live in the dictionary. */
export const MOVEMENT_KINDS: readonly MovementKind[] = ['deposit_out', 'deposit_in', 'volunteer_in']

/**
 * The two halves of the custody money, shown as separate blocks: a Kaution that travels to
 * a counterparty and back, and cash collected from volunteers for the organisation. They
 * behave nothing alike, so every screen shows one of them at a time.
 */
export type CustodyFocus = 'deposits' | 'cash'

/** Whether a *kind* names a pool — for a draft, where the kind is all there is. */
export function isDepositKind(kind: MovementKind): kind is 'deposit_out' | 'deposit_in' {
  return kind === 'deposit_out' || kind === 'deposit_in'
}

/**
 * The same question about a whole row. A separate function because a type predicate
 * narrows only the value it was handed: testing `movement.kind` tells TypeScript nothing
 * about `movement`, so `poolId` would stay invisible. This narrows the union itself.
 */
export function isDepositMovement(movement: Movement): movement is DepositMovement {
  return isDepositKind(movement.kind)
}

/** Which half of the custody money a row belongs to. */
function focusOfMovement(movement: Movement): CustodyFocus {
  return isDepositMovement(movement) ? 'deposits' : 'cash'
}

/** One focus's rows only — what its screen lists. */
export function movementsInFocus(movements: Movement[], focus: CustodyFocus): Movement[] {
  return movements.filter((movement) => focusOfMovement(movement) === focus)
}

/**
 * The kinds a focused form may offer. Cash has exactly one, so its screen can drop the
 * picker entirely; deposits have two, and none at all until a deposit source exists —
 * without a pool to point at, the kinds have nothing to name.
 */
export function kindsForFocus(focus: CustodyFocus, hasDeposits: boolean): readonly MovementKind[] {
  if (focus === 'cash') return ['volunteer_in']
  return hasDeposits ? MOVEMENT_KINDS.filter(isDepositKind) : []
}

/** The form's editable shape: everything a string, euros still euros. */
export type MovementDraft = {
  kind: MovementKind
  date: string // ISO "YYYY-MM-DD"
  name: string
  amount: string // euros as typed
  poolId: string // '' for volunteer money, which belongs to no pool
  /** Handovers only: this is the whole Kaution, even if it is less than the deposit. */
  completesDeposit: boolean
  note: string
}

/**
 * A plain `Omit<Movement, …>` would collapse the union to its shared keys and lose
 * `poolId` entirely. A conditional type over a naked type parameter *distributes* over a
 * union — `T extends unknown ? … : never` applies the Omit to each member separately — so
 * the deposit branch keeps its pool and the volunteer branch still refuses one.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/** A movement without the fields `src/db/` mints. */
export type NewMovement = DistributiveOmit<Movement, 'id' | 'createdAt'>

/** What the hook needs to write a row. `existing` carries id + createdAt forward. */
export type SaveMovementInput = {
  existing: Movement | null
  fields: NewMovement
}

/** What is wrong with the draft, as *codes* — the dictionary turns each into a sentence. */
export type MovementIssue = 'name' | 'amount' | 'date' | 'pool'

/**
 * One deposit pool's custody reading. Every figure is integer cents, and `atVendorCents`
 * is deliberately signed: more money back than went out is a bookkeeping mistake worth
 * showing, not a number to quietly floor.
 */
export type DepositStatus = {
  pool: Pool
  /** The Kaution as granted — the deposit source's amount. */
  fundedCents: number
  handedOverCents: number
  /** A handover was marked final: what went out *is* the whole Kaution, short or not. */
  handoverCompleted: boolean
  returnedCents: number
  /** Kept by the counterparty for damage, booked as an ordinary expense on this pool. */
  forfeitedCents: number
  /** Still with the counterparty: handed over − returned − forfeited. */
  atVendorCents: number
  /** What the organisation eventually gets back: the deposit minus what was kept. */
  toReturnCents: number
}

/** A fresh draft. Today's date is passed in, so this stays testable. */
export function blankMovementDraft(
  todayIso: string,
  kind: MovementKind,
  poolId: string,
): MovementDraft {
  return { kind, date: todayIso, name: '', amount: '', poolId, completesDeposit: false, note: '' }
}

/** Seed the editor from a persisted row. */
export function draftFromMovement(movement: Movement): MovementDraft {
  return {
    kind: movement.kind,
    date: movement.date,
    // Not formatEuros: its "8,00 €" has a currency sign the parser rejects on re-save.
    amount: (movement.amountCents / 100).toFixed(2).replace('.', ','),
    name: movement.name,
    poolId: isDepositMovement(movement) ? movement.poolId : '',
    completesDeposit: isDepositMovement(movement) && movement.completesDeposit === true,
    note: movement.note ?? '',
  }
}

/** Problems with the draft. Empty array = Save is allowed. */
export function movementIssues(draft: MovementDraft): MovementIssue[] {
  const issues: MovementIssue[] = []

  if (draft.name.trim() === '') issues.push('name')

  // The parser refuses a minus sign, so "−5,00" arrives as null. A negative deposit would
  // invert the direction of the movement instead of correcting it.
  const cents = parseEurosToCents(draft.amount)
  if (cents === null || cents <= 0) issues.push('amount')

  if (draft.date === '') issues.push('date')
  // Only the deposit kinds name a pool; volunteer money belongs to no pot at all.
  if (isDepositKind(draft.kind) && draft.poolId === '') issues.push('pool')

  return issues
}

/** The draft as a write payload, or null while `movementIssues` is non-empty. */
export function movementDraftToInput(
  draft: MovementDraft,
  campId: string,
  existing: Movement | null,
): SaveMovementInput | null {
  // One gate, so a caller cannot smuggle an invalid draft past validation.
  if (movementIssues(draft).length > 0) return null

  const amountCents = parseEurosToCents(draft.amount)
  if (amountCents === null) return null // unreachable after the gate; keeps the type honest

  const note = draft.note.trim()
  const common = {
    campId,
    name: draft.name.trim(),
    amountCents,
    date: draft.date,
    note: note === '' ? undefined : note, // an omitted optional field is undefined, not ''
  }

  // Building the two branches separately is what keeps `poolId` off a volunteer row: a
  // spread of the whole draft would carry a stale pool id into money that has no pool.
  const fields: NewMovement = isDepositKind(draft.kind)
    ? {
        ...common,
        kind: draft.kind,
        poolId: draft.poolId,
        // Only a handover can end the handover step; a return carrying the flag would
        // silently tick a step it knows nothing about.
        completesDeposit: draft.kind === 'deposit_out' && draft.completesDeposit,
      }
    : { ...common, kind: draft.kind }

  return { existing, fields }
}

/**
 * Newest first. ISO dates compare correctly as plain strings; `createdAt` and the id break
 * ties, so two rows written in the same millisecond on two phones land in the same order
 * on both.
 */
export function sortMovements(movements: Movement[]): Movement[] {
  return movements.toSorted(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt || a.id.localeCompare(b.id),
  )
}

/**
 * One deposit pool's custody reading.
 *
 * The reconciliation that matters: a forfeited Kaution is booked *once*, as an expense on
 * the deposit pool. Subtracting it from what is still out is what stops "€30 kept for
 * damage" from also reading as "€30 the shop still owes you".
 */
export function depositStatus(summary: PoolSummary, movements: Movement[]): DepositStatus {
  let handedOverCents = 0
  let returnedCents = 0
  let handoverCompleted = false

  for (const movement of movements) {
    if (!isDepositMovement(movement) || movement.poolId !== summary.pool.id) continue
    if (movement.kind === 'deposit_out') {
      handedOverCents += movement.amountCents
      // Any one handover may close the step: the last instalment is the one that carries
      // the flag, whatever the instalments before it added up to.
      handoverCompleted ||= movement.completesDeposit === true
    } else returnedCents += movement.amountCents
  }

  // The pool's expenses *are* the forfeited money: a deposit pool has no other spending.
  const forfeitedCents = summary.spentCents

  return {
    pool: summary.pool,
    fundedCents: summary.fundedCents,
    handedOverCents,
    handoverCompleted,
    returnedCents,
    forfeitedCents,
    atVendorCents: handedOverCents - returnedCents - forfeitedCents,
    // Floored: keeping more for damage than the deposit was worth still returns nothing,
    // never a negative amount that would eat another pool's leftover in the total.
    toReturnCents: Math.max(0, summary.fundedCents - forfeitedCents),
  }
}

/**
 * How far one step of a deposit has got. `over` is a mistake worth showing rather than
 * clamping: more money out or back than expected means a row was entered wrong.
 */
export type DepositStepState = 'todo' | 'partial' | 'done' | 'over'

/** One step, with the figures the strip prints next to its tick. */
export type DepositStep = {
  state: DepositStepState
  doneCents: number
  targetCents: number
}

/** A deposit's life as two checkable steps: it goes out, then it comes back. */
export type DepositSteps = {
  out: DepositStep
  back: DepositStep
}

function step(doneCents: number, targetCents: number): DepositStep {
  // Nothing to do is done: a €0 deposit, or a return after the whole Kaution was forfeited,
  // would otherwise sit unticked forever with no way to complete it.
  const state: DepositStepState =
    targetCents <= 0
      ? 'done'
      : doneCents <= 0
        ? 'todo'
        : doneCents > targetCents
          ? 'over'
          : doneCents === targetCents
            ? 'done'
            : 'partial'

  return { state, doneCents, targetCents }
}

/**
 * The checklist reading of a deposit.
 *
 * The second step's target is what *can* still come back — handed over minus forfeited —
 * not the deposit as granted. Money the counterparty kept for damage is gone by agreement,
 * so counting it as an outstanding return would leave the step permanently short.
 */
export function depositSteps(status: DepositStatus): DepositSteps {
  // A handover declared final measures itself: the counterparty wanted less than the
  // organisation granted, so the step is complete at the amount that actually went out.
  const out = status.handoverCompleted
    ? step(status.handedOverCents, status.handedOverCents)
    : step(status.handedOverCents, status.fundedCents)

  // A deposit that has not left yet has no amount to come back either, but the step is
  // still ahead of you — `step` would read that empty target as finished.
  const back =
    status.handedOverCents === 0 && status.fundedCents > 0
      ? ({ state: 'todo', doneCents: 0, targetCents: 0 } as const)
      : step(status.returnedCents, Math.max(0, status.handedOverCents - status.forfeitedCents))

  return { out, back }
}

/** One reading per deposit pool, in the order the pools were created. */
export function depositStatuses(summaries: PoolSummary[], movements: Movement[]): DepositStatus[] {
  return depositPools(summaries).map((s) => depositStatus(s, movements))
}

/**
 * The whole custody picture in one value: every deposit's reading plus the volunteer
 * money. Bundled because the dashboard strip and the movements screen must show the same
 * figures, and passing one computed value beats recomputing three in two places.
 */
export type CustodyReading = {
  statuses: DepositStatus[]
  volunteerHeldCents: number
  /** How many handovers the volunteer total is made of — one row per volunteer. */
  volunteerCount: number
}

export function custodyReading(summaries: PoolSummary[], movements: Movement[]): CustodyReading {
  return {
    statuses: depositStatuses(summaries, movements),
    volunteerHeldCents: volunteerHeldCents(movements),
    volunteerCount: movements.filter((m) => m.kind === 'volunteer_in').length,
  }
}

/** Volunteers' cash you are holding for the organisation. There is no `volunteer_out`. */
export function volunteerHeldCents(movements: Movement[]): number {
  return movements.reduce((sum, m) => (m.kind === 'volunteer_in' ? sum + m.amountCents : sum), 0)
}

/** Σ what is still with counterparties. Floored per pool: an over-returned deposit must
 *  not cancel out another one that is genuinely still outstanding. */
export function custodyOutstandingCents(statuses: DepositStatus[]): number {
  return statuses.reduce((sum, s) => sum + Math.max(0, s.atVendorCents), 0)
}
