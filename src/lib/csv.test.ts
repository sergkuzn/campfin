import { describe, expect, it } from 'vitest'
import { csvAmount, toCsv } from './csv'

describe('csvAmount', () => {
  it('writes cents as a comma decimal', () => {
    expect(csvAmount(123_456)).toBe('1234,56')
    expect(csvAmount(0)).toBe('0,00')
    expect(csvAmount(5)).toBe('0,05')
    expect(csvAmount(100)).toBe('1,00')
  })

  it('keeps a negative amount readable', () => {
    expect(csvAmount(-2050)).toBe('-20,50')
  })
})

describe('toCsv', () => {
  it('separates cells with a semicolon and rows with CRLF', () => {
    expect(toCsv([['a', 'b'], ['c']])).toBe('a;b\r\nc')
  })

  it('quotes a cell containing the separator', () => {
    expect(toCsv([['Bread; rolls', '2,50']])).toBe('"Bread; rolls";2,50')
  })

  it('doubles an embedded quote', () => {
    expect(toCsv([['He said "hi"']])).toBe('"He said ""hi"""')
  })

  it('quotes a cell containing a newline', () => {
    expect(toCsv([['two\nlines']])).toBe('"two\nlines"')
  })

  it('writes an empty row as a blank line', () => {
    expect(toCsv([['a'], [], ['b']])).toBe('a\r\n\r\nb')
  })
})
