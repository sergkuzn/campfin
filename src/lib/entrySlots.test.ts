import { describe, expect, it } from 'vitest'
import { parseHiddenSlots, serialiseHiddenSlots, toggleHiddenSlot } from './entrySlots'

describe('parseHiddenSlots', () => {
  it('reads an empty list from a camp that has never hidden anything', () => {
    expect(parseHiddenSlots(undefined)).toEqual([])
  })

  it('reads an empty list from the cleared field', () => {
    // Unhiding the last card writes '', so this is the value the field settles at.
    expect(parseHiddenSlots('')).toEqual([])
  })

  it('reads one key', () => {
    expect(parseHiddenSlots('fee')).toEqual(['fee'])
  })

  it('reads several, in the order the group draws them', () => {
    expect(parseHiddenSlots('other,deposits')).toEqual(['deposits', 'other'])
  })

  it('drops a key this build does not know', () => {
    // A camp last touched by a newer build must not break this one.
    expect(parseHiddenSlots('fee,pfand')).toEqual(['fee'])
  })

  it('drops a repeated key', () => {
    expect(parseHiddenSlots('fee,fee')).toEqual(['fee'])
  })

  it('tolerates the spaces a hand-edited field might carry', () => {
    expect(parseHiddenSlots(' fee , other ')).toEqual(['fee', 'other'])
  })
})

describe('serialiseHiddenSlots', () => {
  it('writes the empty string when nothing is hidden', () => {
    expect(serialiseHiddenSlots([])).toBe('')
  })

  it('writes the keys in slot order, whatever order they arrive in', () => {
    expect(serialiseHiddenSlots(['other', 'deposits'])).toBe('deposits,other')
  })

  it('round-trips through parse', () => {
    expect(parseHiddenSlots(serialiseHiddenSlots(['deposits', 'fee', 'other']))).toEqual([
      'deposits',
      'fee',
      'other',
    ])
  })
})

describe('toggleHiddenSlot', () => {
  it('hides a shown card', () => {
    expect(toggleHiddenSlot([], 'fee')).toEqual(['fee'])
  })

  it('shows a hidden card', () => {
    expect(toggleHiddenSlot(['fee'], 'fee')).toEqual([])
  })

  it('leaves the other cards alone', () => {
    expect(toggleHiddenSlot(['deposits'], 'other')).toEqual(['deposits', 'other'])
  })

  it('does not mutate the list it was given', () => {
    const hidden = ['fee'] as const
    toggleHiddenSlot([...hidden], 'other')
    expect(hidden).toEqual(['fee'])
  })

  it('hides all three', () => {
    const all = (['deposits', 'fee', 'other'] as const).reduce<ReturnType<typeof toggleHiddenSlot>>(
      (hidden, slot) => toggleHiddenSlot(hidden, slot),
      [],
    )
    expect(all).toEqual(['deposits', 'fee', 'other'])
  })
})
