import './JoinCodeCard.css'
import { useCopyToClipboard } from '../hooks/useCopyToClipboard'
import { useT } from '../i18n'

type Props = {
  joinCode: string
  /** How many leaders share this camp. A count, never names. */
  memberCount: number
}

/**
 * The join code as one big button. The code is the large element because it also gets
 * read out over the phone; the line under it says the tap copies, so the button is not
 * mistaken for a plain label.
 */
export function JoinCodeCard({ joinCode, memberCount }: Props) {
  const t = useT()
  const [state, copy] = useCopyToClipboard()

  return (
    <section className="join-code">
      <button className="join-code__button" type="button" onClick={() => copy(joinCode)}>
        <span className="join-code__code">{joinCode}</span>
        {/* aria-live so the swap to "Copied" is announced, not just seen. */}
        <span className="join-code__action" aria-live="polite">
          {state === 'copied' ? t.share.copied : t.share.copy}
        </span>
      </button>
      <p className="join-code__members">{t.share.members(memberCount)}</p>
      {state === 'failed' && (
        <p className="join-code__error" role="alert">
          {t.share.copyFailed}
        </p>
      )}
    </section>
  )
}
