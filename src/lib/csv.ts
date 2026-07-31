/**
 * CSV, for handing the numbers to accounting. Pure text work only: this module never sees
 * a label or a currency symbol, because `src/lib/` does not decide how the UI reads — the
 * caller builds the cells from the dictionary and passes strings in.
 *
 * Two conventions, both chosen for the reader (a German Excel):
 * - **semicolon separator**, because a comma is the decimal mark here;
 * - **CRLF line endings**, which is what RFC 4180 specifies and what Excel expects.
 */

const SEPARATOR = ';'
const LINE_END = '\r\n'

/** Integer cents as a plain decimal: 123456 → "1234,56". No thousands mark, no "€" — a
 *  spreadsheet wants a number it can add up, not a formatted amount. */
export function csvAmount(cents: number): string {
  // Sign handled separately, so the minus never lands between the digits and the comma.
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`
}

/** A cell only needs quoting when it would otherwise break the row apart; an inner quote
 *  is escaped by doubling it, which is the one escape CSV has. */
function csvCell(value: string): string {
  if (!/[";\r\n]/.test(value)) return value
  return `"${value.replaceAll('"', '""')}"`
}

/** Rows of cells as one CSV document. A row of zero cells is an empty line — that is how
 *  the caller separates two sections in the same file. */
export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((cells) => cells.map(csvCell).join(SEPARATOR)).join(LINE_END)
}
