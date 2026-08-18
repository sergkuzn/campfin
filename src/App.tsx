import './App.css'
import { AppVersion } from './components/AppVersion'
import { ReloadPrompt } from './components/ReloadPrompt'
import { SignedInApp } from './components/SignedInApp'
import { SignIn } from './components/SignIn'
import { useSession } from './hooks/useSession'
import { useT } from './i18n'

/**
 * The gate. Auth is the only thing this component knows about: while the session is
 * resolving it says so, without one it shows the sign-in form, and with one it hands the
 * whole app to `SignedInApp`.
 *
 * The session resolves from local storage, so a phone with no signal at camp is still
 * signed in and still has its camp — being offline is not being signed out.
 */
export default function App() {
  const t = useT()
  const { session, isLoading, error, signOut } = useSession()

  const renderBody = () => {
    if (isLoading) return <p className="app__loading">{t.app.loading}</p>
    if (error !== null)
      return (
        <p className="app__error" role="alert">
          {error}
        </p>
      )
    if (session === null) return <SignIn />
    return <SignedInApp session={session} />
  }

  return (
    <main className="app">
      <header className="app__header">
        <h1 className="app__title">{t.app.title}</h1>
        <p className="app__subtitle">{t.app.subtitle}</p>
        {session !== null && (
          <p className="app__session">
            <span className="app__email">{session.email}</span>
            <button className="app__sign-out" type="button" onClick={signOut}>
              {t.auth.signOut}
            </button>
          </p>
        )}
      </header>

      {renderBody()}

      <AppVersion />
      <ReloadPrompt />
    </main>
  )
}
