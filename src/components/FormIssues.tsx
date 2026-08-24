/**
 * What is blocking Save, listed under a form. Nothing is rendered while the draft is
 * valid, so a caller can hand over an empty array unconditionally.
 *
 * Generic over the issue codes rather than typed to one form's union: `lib/` reports
 * problems as codes and each form owns its own dictionary of sentences. Tying the two
 * together in one type parameter is what makes a missing translation a build error —
 * `labels` has to cover every code `issues` can hold.
 */
type FormIssuesProps<Issue extends string> = {
  issues: readonly Issue[]
  labels: Readonly<Record<Issue, string>>
}

export function FormIssues<Issue extends string>({ issues, labels }: FormIssuesProps<Issue>) {
  if (issues.length === 0) return null

  return (
    <ul className="card__issues">
      {issues.map((issue) => (
        <li key={issue}>{labels[issue]}</li>
      ))}
    </ul>
  )
}
