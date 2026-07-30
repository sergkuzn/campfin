/**
 * Hand a file to the browser. The DOM half of the JSON escape hatch — the object being
 * saved is built by the pure `buildCampExport`, so nothing about *what* gets exported
 * depends on this file.
 */

/** Saves `text` as `filename`. On a phone this lands in Downloads or the share sheet. */
export function downloadJson(filename: string, text: string): void {
  // A Blob URL rather than a data: URL — no size limit worth worrying about, and it can be
  // released again. The anchor is never in the document; clicking a detached one works.
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
