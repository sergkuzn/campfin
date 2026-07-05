import { describe, expect, it } from 'vitest'
import { basePersonDays, formatEuros, type PerDiemConfig, perDiemBudgetCents } from './budget'

const camp: PerDiemConfig = {
  ratePerPersonDayCents: 1250, // €12.50
  numParticipants: 10,
  numLeaders: 2,
  numDays: 14,
  leaderLeadDays: 1,
}

describe('basePersonDays', () => {
  it('counts participants for the camp and leaders for camp + lead days', () => {
    // 10 × 14 + 2 × (14 + 1) = 140 + 30 = 170
    expect(basePersonDays(camp)).toBe(170)
  })

  it('handles zero lead days', () => {
    // 10 × 7 + 1 × (7 + 0) = 70 + 7 = 77
    expect(basePersonDays({ ...camp, numLeaders: 1, numDays: 7, leaderLeadDays: 0 })).toBe(77)
  })
})

describe('perDiemBudgetCents', () => {
  it('multiplies rate by total person-days, staying in integer cents', () => {
    // 1250 cents × 170 person-days = 212500 cents (€2,125.00)
    const cents = perDiemBudgetCents(camp)
    expect(cents).toBe(212500)
    expect(Number.isInteger(cents)).toBe(true)
  })
})

describe('formatEuros', () => {
  it('renders integer cents as a euro amount only at the display edge', () => {
    // Assert loosely: exact spacing/glyph is ICU-version dependent, the digits are not.
    const s = formatEuros(212500)
    expect(s).toContain('2.125')
    expect(s).toContain('€')
  })
})
