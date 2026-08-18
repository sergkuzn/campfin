import { useRegisterSW } from 'virtual:pwa-register/react'
import { useEffect, useState } from 'react'
import { UpdateToast } from './UpdateToast'

/** How often an open app re-asks the server whether a newer build has been deployed.
 *  Once a day: a deploy mid-camp is rare, and returning to the foreground checks anyway. */
const UPDATE_CHECK_MS = 24 * 60 * 60 * 1000

/**
 * Re-checks for a new service worker on a timer and whenever the app returns to the
 * foreground. The browser only looks for one by itself on a navigation, and an installed
 * PWA that lives on a home screen for two weeks barely navigates — without this a deploy
 * could go unnoticed for days.
 *
 * `registration` is undefined until the worker has registered (and stays undefined in dev
 * and test builds, where the plugin's virtual module is a no-op stub), so the effect
 * re-runs when it arrives and does nothing until then.
 */
function useUpdateCheck(registration: ServiceWorkerRegistration | undefined) {
  useEffect(() => {
    if (registration === undefined) return

    const check = () => {
      // A camp phone is regularly out of signal. `update()` offline would only produce a
      // failed fetch, so skip it and wait for the next trigger.
      if (!navigator.onLine) return
      void registration.update()
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }

    const timer = setInterval(check, UPDATE_CHECK_MS)
    document.addEventListener('visibilitychange', onVisible)
    // Cleanup runs when `registration` changes or the app unmounts, so neither the timer
    // nor the listener outlives the effect that made it.
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [registration])
}

/**
 * Connects the service worker to the update toast, and the only place in the app that
 * touches `virtual:pwa-register/react`.
 *
 * `needRefresh` turns true once a new build has downloaded and is waiting. Calling
 * `updateServiceWorker` tells that worker to take over; the plugin's own listener reloads
 * the page as soon as it does, so there is no reload to write here.
 */
export function ReloadPrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | undefined>()

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, r) {
      setRegistration(r)
    },
  })

  useUpdateCheck(registration)

  return (
    <UpdateToast
      show={needRefresh}
      onReload={() => void updateServiceWorker()}
      // Dismissing only hides the toast — the waiting worker stays waiting, and takes
      // over on the next full restart of the app.
      onDismiss={() => setNeedRefresh(false)}
    />
  )
}
