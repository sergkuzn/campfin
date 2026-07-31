import { describe, expect, it } from 'vitest'
import { en } from './en'

/** Every leaf of the nested dictionary, with the property path that reaches it. */
function leaves(node: unknown, path: string): [string, unknown][] {
  if (typeof node !== 'object' || node === null) return [[path, node]]
  return Object.entries(node).flatMap(([key, value]) =>
    leaves(value, path === '' ? key : `${path}.${key}`),
  )
}

describe('the English dictionary', () => {
  it('has no empty or whitespace-only strings', () => {
    const blank = leaves(en, '')
      .filter(([, value]) => typeof value === 'string' && value.trim() === '')
      .map(([path]) => path)
    expect(blank).toEqual([])
  })

  it('contains only strings and interpolation functions', () => {
    const wrong = leaves(en, '')
      .filter(([, value]) => typeof value !== 'string' && typeof value !== 'function')
      .map(([path]) => path)
    expect(wrong).toEqual([])
  })

  it('branches its plurals on n', () => {
    expect(en.blocks.days(1)).toBe('1 day')
    expect(en.blocks.days(2)).toBe('2 days')
    expect(en.blocks.personDays(1)).toBe('1 person-day')
    expect(en.blocks.personDays(0)).toBe('0 person-days')
    expect(en.pools.deleteSources(1, '€1')).toContain('1 income source ')
    expect(en.pools.deleteSources(2, '€1')).toContain('2 income sources ')
    expect(en.receipts.count(1)).toBe('1 receipt')
    expect(en.receipts.count(3)).toBe('3 receipts')
  })

  it('interpolates its arguments rather than dropping them', () => {
    expect(en.camps.nameTaken('Moorwerder')).toContain('Moorwerder')
    expect(en.dashboard.deleteConfirm('Moorwerder')).toContain('Moorwerder')
    expect(en.pools.sourceDeleteLine('€20,00', 'Everyday')).toContain('€20,00')
    expect(en.pools.sourceDeleteLine('€20,00', 'Everyday')).toContain('Everyday')
    expect(en.receipts.dayTotal('€32,50')).toContain('€32,50')
    expect(en.bars.spentOfFunded('€10,00', '€40,00')).toContain('€10,00')
    expect(en.bars.spentOfFunded('€10,00', '€40,00')).toContain('€40,00')
    expect(en.bars.over('€5,00')).toContain('€5,00')
    expect(en.bars.unusable('€300,00')).toContain('€300,00')
    expect(en.attendance.comparison('€2.180,00', '€1.880,00')).toContain('€2.180,00')
    expect(en.attendance.comparison('€2.180,00', '€1.880,00')).toContain('€1.880,00')
    expect(en.attendance.goesBack('€300,00')).toContain('€300,00')
    expect(en.attendance.overAttended('€120,00')).toContain('€120,00')
    expect(en.burn.overspentBy('€40,00')).toContain('€40,00')
    expect(en.burn.spentToday('€12,00')).toContain('€12,00')
    expect(en.burn.normalDay('€80,00')).toContain('€80,00')
    expect(en.burn.chartAlt(14)).toContain('14')
    expect(en.settlement.rows.poolUnspent('Group money')).toContain('Group money')
    expect(en.settlement.rows.depositReturn('Bikes')).toContain('Bikes')
    expect(en.settlement.warnings.poolOverspent('Group money', '€8,00')).toContain('€8,00')
    expect(en.settlement.warnings.depositAtVendor('Bikes', '€200,00')).toContain('Bikes')
    expect(en.settlement.warnings.overAttended('Group money', '€60,00')).toContain('€60,00')
  })
})
