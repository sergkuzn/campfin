import { useState } from 'react'
import './SignIn.css'
import { authErrorMessage, sendMagicCode, signInWithMagicCode } from '../db/auth'
import { useT } from '../i18n'

/**
 * The sign-in screen: an email, then the code that arrives by mail. Two steps, and which
 * one shows is derived from a single piece of state — `sentTo` is both "have we sent one?"
 * and "who to". Two booleans could contradict each other; this cannot.
 */
export function SignIn() {
  const t = useT()
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSendCode = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = email.trim()
    if (trimmed === '' || busy) return

    setBusy(true)
    setError(null)
    // Promise chaining rather than an async handler: an event handler that returns a
    // promise is a floating promise React never awaits, and `finally` is the one place
    // that reliably clears the busy flag on both paths.
    sendMagicCode(trimmed)
      .then(() => setSentTo(trimmed))
      .catch((cause: unknown) => setError(authErrorMessage(cause, t.auth.sendFailed)))
      .finally(() => setBusy(false))
  }

  const handleVerify = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = code.trim()
    if (sentTo === null || trimmed === '' || busy) return

    setBusy(true)
    setError(null)
    // No success branch: signing in changes the auth state, and the whole tree re-renders
    // into the app. There is nothing left of this screen to update.
    signInWithMagicCode(sentTo, trimmed)
      .catch((cause: unknown) => {
        setError(authErrorMessage(cause, t.auth.verifyFailed))
        setCode('')
      })
      .finally(() => setBusy(false))
  }

  const restart = () => {
    setSentTo(null)
    setCode('')
    setError(null)
  }

  if (sentTo === null) {
    return (
      <form className="sign-in" onSubmit={handleSendCode}>
        <h2 className="sign-in__title">{t.auth.title}</h2>
        <p className="sign-in__intro">{t.auth.intro}</p>
        <input
          className="sign-in__input"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
          placeholder={t.auth.emailPlaceholder}
          aria-label={t.auth.emailLabel}
        />
        <button
          className="btn btn--primary btn--block"
          type="submit"
          disabled={busy || email.trim() === ''}
        >
          {busy ? t.auth.sending : t.auth.sendCode}
        </button>
        {error !== null && (
          <p className="sign-in__error" role="alert">
            {error}
          </p>
        )}
      </form>
    )
  }

  return (
    <form className="sign-in" onSubmit={handleVerify}>
      <h2 className="sign-in__title">{t.auth.codeTitle}</h2>
      <p className="sign-in__intro">{t.auth.codeIntro(sentTo)}</p>
      <input
        className="sign-in__input"
        type="text"
        // A numeric keypad on a phone, and the OS offers the code from the mail app.
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        // biome-ignore lint/a11y/noAutofocus: the code is the only thing left to type here
        autoFocus
        value={code}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => setCode(event.target.value)}
        placeholder={t.auth.codePlaceholder}
        aria-label={t.auth.codeLabel}
      />
      <button
        className="btn btn--primary btn--block"
        type="submit"
        disabled={busy || code.trim() === ''}
      >
        {t.auth.verify}
      </button>
      <button className="sign-in__link" type="button" onClick={restart}>
        {t.auth.otherEmail}
      </button>
      {error !== null && (
        <p className="sign-in__error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
