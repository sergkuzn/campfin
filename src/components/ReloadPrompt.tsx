import { useRegisterSW } from 'virtual:pwa-register/react'
import { useEffect, useState } from 'react'

/** How often an open app re-asks the server whether a newer build has been deployed.
 *  Once a day: a deploy mid-camp is rare, and returning to the foreground checks anyway. */
const UPDATE_CHECK_MS = 24 * 60 * 60 * 1000

/**
 * Re-checks for a new service worker immediately on mount, on a timer, and whenever the
 * app returns to the foreground. A plain reload does *not* by itself force a check — it
 * reuses whatever worker is already controlling the page — so an explicit check on mount
 * is what makes reload useful. The browser also checks by itself on navigation, but throttles
 * that to roughly once a day; explicit `update()` calls bypass that throttle, which matters
 * for a PWA that lives on a home screen for two weeks and barely navigates.
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

    check()
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
 * The only place in the app that touches `virtual:pwa-register/react`. Renders nothing:
 * `registerType: 'autoUpdate'` (see `vite.config.ts`) means a newly downloaded service
 * worker takes over on its own, so as soon as `needRefresh` turns true this reloads the
 * page immediately rather than waiting for someone to notice a prompt.
 */
export function ReloadPrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | undefined>()

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, r) {
      setRegistration(r)
    },
  })

  useUpdateCheck(registration)

  useEffect(() => {
    if (needRefresh) void updateServiceWorker(true)
  }, [needRefresh, updateServiceWorker])

  return null
}
