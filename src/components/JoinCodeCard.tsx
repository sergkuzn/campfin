import { useEffect, useState } from 'react'
import './JoinCodeCard.css'
import { useT } from '../i18n'

type Props = {
  joinCode: string
  /** How many leaders share this camp. A count, never names. */
  memberCount: number
}

/** Idle, or the outcome of the last copy attempt. */
type CopyState = 'idle' | 'copied' | 'failed'

/**
 * The join code as one big button. The code is the large element because it also gets
 * read out over the phone; the line under it says the tap copies, so the button is not
 * mistaken for a plain label.
 */
export function JoinCodeCard({ joinCode, memberCount }: Props) {
  const t = useT()
  const [state, setState] = useState<CopyState>('idle')

  // A timer is an external system, and it must be cleared if the component unmounts (or
  // the code is copied again) before it fires. Only the success message expires — a
  // failure should stay on screen until the next attempt.
  useEffect(() => {
    if (state !== 'copied') return
    const timer = window.setTimeout(() => setState('idle'), 2000)
    return () => window.clearTimeout(timer)
  }, [state])

  const handleCopy = async () => {
    try {
      // `navigator.clipboard` is undefined outside a secure context, so reading it is
      // itself part of what can throw.
      await navigator.clipboard.writeText(joinCode)
      setState('copied')
    } catch {
      setState('failed')
    }
  }

  return (
    <section className="join-code">
      {/* `void` marks the floating promise as deliberate: the handler is fire-and-forget,
          the outcome lands in state. */}
      <button className="join-code__button" type="button" onClick={() => void handleCopy()}>
        <span className="join-code__code">{joinCode}</span>
        {/* aria-live so the swap to "Copied" is announced, not just seen. */}
        <span className="join-code__action" aria-live="polite">
          {state === 'copied' ? t.share.copied : t.share.copy}
        </span>
      </button>
      <p className="join-code__hint">{t.share.hint}</p>
      <p className="join-code__members">{t.share.members(memberCount)}</p>
      {state === 'failed' && (
        <p className="join-code__error" role="alert">
          {t.share.copyFailed}
        </p>
      )}
    </section>
  )
}
