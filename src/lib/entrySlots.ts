/**
 * Which of the dashboard's entry cards a camp shows.
 *
 * Not every camp collects deposits, charges a participation fee or spends out of pocket,
 * and a card for money that will never be entered is a permanent piece of noise on the one
 * screen used daily. So the group is a *choice*, stored per camp rather than per phone:
 * "this camp has no pfand" is a fact about the camp, and both leaders should see the same
 * four — or two — cards.
 *
 * Receipts is deliberately not in this union. Every camp enters receipts, and leaving it
 * out means the group can never collapse to a caption with nothing under it.
 *
 * Hiding is a dashboard choice and nothing more: the report, the CSV and the settlement
 * keep counting every euro of a hidden slot. It changes what is *offered*, never what is
 * *counted*.
 */

/** The three hideable cards, in the order the group draws them. */
export const ENTRY_SLOTS = ['deposits', 'fee', 'other'] as const

/** A union of the literals above, so adding a card to the list is the only edit needed. */
export type EntrySlot = (typeof ENTRY_SLOTS)[number]

/**
 * Read the stored field: a comma-separated list of slot keys, or nothing at all.
 *
 * One string rather than a boolean per card, because the set of cards will keep growing and
 * each new boolean would be another optional attribute to push. Unknown keys are dropped —
 * a camp last touched by a newer build must not make this one throw — and so are duplicates,
 * so the result is always a clean set in `ENTRY_SLOTS` order.
 */
export function parseHiddenSlots(raw: string | undefined): EntrySlot[] {
  if (raw === undefined) return []
  const stored = new Set(raw.split(',').map((part) => part.trim()))
  return ENTRY_SLOTS.filter((slot) => stored.has(slot))
}

/**
 * Back to the stored form. Always a string, never `undefined`: unhiding the last card has
 * to write something that clears the field, and an empty string is what does that.
 */
export function serialiseHiddenSlots(hidden: EntrySlot[]): string {
  return ENTRY_SLOTS.filter((slot) => hidden.includes(slot)).join(',')
}

/** Flip one card. Returns a new list — the caller hands it straight to a write. */
export function toggleHiddenSlot(hidden: EntrySlot[], slot: EntrySlot): EntrySlot[] {
  return hidden.includes(slot)
    ? hidden.filter((each) => each !== slot)
    : ENTRY_SLOTS.filter((each) => each === slot || hidden.includes(each))
}
