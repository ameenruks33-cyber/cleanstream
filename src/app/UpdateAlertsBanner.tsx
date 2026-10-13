import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import {
  PUSH_BANNER_DISMISS_KEY,
  enableUpdateNotifications,
  notificationPermission,
} from '@/lib/deviceUpdates'
import { isStandaloneDisplay } from '@/lib/pwa'

export function UpdateAlertsBanner() {
  const [permission, setPermission] = useState(notificationPermission)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(() => {
    if (typeof sessionStorage === 'undefined') return false
    return sessionStorage.getItem(PUSH_BANNER_DISMISS_KEY) === '1'
  })

  useEffect(() => {
    setPermission(notificationPermission())
  }, [])

  if (dismissed) return null
  if (permission === 'granted' || permission === 'unsupported') return null
  if (permission === 'denied' && !isStandaloneDisplay()) return null

  async function enable() {
    setBusy(true)
    const result = await enableUpdateNotifications()
    setPermission(notificationPermission())
    setMessage(result.message)
    setBusy(false)
    if (result.ok) setDismissed(true)
  }

  function dismiss() {
    sessionStorage.setItem(PUSH_BANNER_DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className="fixed inset-x-0 bottom-[max(4.5rem,env(safe-area-inset-bottom))] z-50 px-4 md:bottom-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-3 rounded-3xl border border-tide/50 bg-panel px-5 py-4 shadow-2xl sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="font-medium">Update alerts are off on this device</p>
          <p className="mt-1 text-sm leading-6 text-muted">
            {permission === 'denied'
              ? 'Notifications are blocked. Allow them for this site in the phone or browser settings, then tap Enable.'
              : 'Installed phones and computers only show an update notification after you allow alerts. Tap Enable, then look for a test notification.'}
          </p>
          {message ? <p className="mt-1 text-sm text-tide">{message}</p> : null}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button onClick={dismiss}>Not now</Button>
          <Button variant="primary" disabled={busy} onClick={() => void enable()}>
            Enable alerts
          </Button>
        </div>
      </div>
    </div>
  )
}
