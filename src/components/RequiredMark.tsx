/**
 * The red star after the label of a field that blocks Save. Decoration only — it is
 * hidden from screen readers, which learn the same thing from `aria-required` on the
 * control (where its role accepts the attribute — date and number inputs don't) and from
 * the issues list under the form.
 *
 * A field with no star is optional; nothing says so in words.
 */
export function RequiredMark() {
  return (
    <span className="field__required" aria-hidden="true">
      *
    </span>
  )
}
