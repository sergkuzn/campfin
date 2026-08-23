import './JoinCampForm.css'
import { type JoinStatus, useJoinCamp } from '../hooks/useJoinCamp'
import { useT } from '../i18n'

type Props = {
  userId: string
  /** Camps I am already in — so the form can say "you are already in this one". */
  myCampIds: string[]
}

/**
 * Type a code, see which camp it belongs to, join it. The lookup happens as the code is
 * typed, so the camp's name is on screen *before* committing — which is the only way to be
 * sure you are joining the right camp when the only thing you were sent is eight characters.
 */
export function JoinCampForm({ userId, myCampIds }: Props) {
  const t = useT()
  const { code, setCode, status, found, error, join } = useJoinCamp(userId, myCampIds)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (status === 'found') join()
  }

  return (
    <form className="join-camp" onSubmit={handleSubmit}>
      <p className="join-camp__hint">{t.join.hint}</p>
      <div className="join-camp__row">
        <input
          className="join-camp__input"
          type="text"
          value={code}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setCode(event.target.value)}
          placeholder={t.join.placeholder}
          aria-label={t.join.label}
          autoComplete="off"
          // The code is uppercase-only; leaving the shift key out of it is one less way to
          // mistype eight characters read off someone else's screen.
          autoCapitalize="characters"
          spellCheck={false}
        />
        <button className="btn btn--ghost" type="submit" disabled={status !== 'found'}>
          {t.join.join}
        </button>
      </div>

      <JoinStatusLine status={status} campName={found?.name ?? ''} />

      {error !== null && (
        <p className="join-camp__error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}

/** The one line under the input. Split out so the form above stays readable. */
function JoinStatusLine({ status, campName }: { status: JoinStatus; campName: string }) {
  const t = useT()

  switch (status) {
    case 'searching':
      return <p className="join-camp__status">{t.join.searching}</p>
    case 'notFound':
      return <p className="join-camp__status">{t.join.notFound}</p>
    case 'found':
      return <p className="join-camp__status join-camp__status--ok">{t.join.found(campName)}</p>
    case 'alreadyMember':
      return <p className="join-camp__status">{t.join.alreadyMember(campName)}</p>
    default:
      return null
  }
}
