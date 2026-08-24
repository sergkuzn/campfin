/**
 * Hand a file to the browser. The DOM half of the export hatch — what goes *into* the file
 * is built by the pure `toCsv`, so nothing about the content depends on this file.
 */

/** Saves `text` as `filename`. On a phone this lands in Downloads or the share sheet. */
function download(filename: string, text: string, mimeType: string): void {
  // A Blob URL rather than a data: URL — no size limit worth worrying about, and it can be
  // released again. The anchor is never in the document; clicking a detached one works.
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

/**
 * The same, for accounting's spreadsheet. The leading U+FEFF byte-order mark is what makes
 * Excel read the file as UTF-8 — without it "Straßenfest" opens as "StraÃenfest".
 */
export function downloadCsv(filename: string, text: string): void {
  download(filename, `\uFEFF${text}`, 'text/csv;charset=utf-8')
}
