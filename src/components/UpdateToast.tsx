import './UpdateToast.css'
import { useT } from '../i18n'

type Props = {
  /** Whether a downloaded build is waiting to take over. */
  show: boolean
  onReload: () => void
  onDismiss: () => void
}

/**
 * The "new version available" toast, with no knowledge of service workers — it takes a
 * boolean and two callbacks. The service-worker plumbing lives in `ReloadPrompt`, which
 * is stubbed out in dev and test builds; keeping the markup here is what makes the thing
 * the user actually sees testable.
 */
export function UpdateToast({ show, onReload, onDismiss }: Props) {
  const t = useT()

  return (
    // The live region is always in the DOM and only its contents change. A screen reader
    // has to be watching a region before it can report an update to it, so one that
    // appears already-filled is often announced late or not at all.
    //
    // role="status" announces politely, without stealing focus from whatever is being
    // typed — the whole point of not reloading unbidden.
    <div className="update-toast" role="status" aria-label={t.update.label}>
      {show && (
        <div className="update-toast__box">
          <span className="update-toast__message">{t.update.available}</span>
          <button className="update-toast__button" type="button" onClick={onDismiss}>
            {t.update.dismiss}
          </button>
          <button
            className="update-toast__button update-toast__button--primary"
            type="button"
            onClick={onReload}
          >
            {t.update.reload}
          </button>
        </div>
      )}
    </div>
  )
}
