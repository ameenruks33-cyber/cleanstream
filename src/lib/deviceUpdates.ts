export const PUSH_ENABLED_KEY = 'cleanstream.push-enabled'
export const PUSH_BANNER_DISMISS_KEY = 'cleanstream.push-banner-dismissed'
const PERIODIC_SYNC_TAG = 'cleanstream-version'
const PERIODIC_SYNC_MS = 15 * 60 * 1000
const UPDATE_TAG = 'mytube-update'

type VapidResponse = { configured: boolean; publicKey: string | null }

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

export function pushEnabledPreference(): boolean {
  return localStorage.getItem(PUSH_ENABLED_KEY) === '1'
}

export function shouldShowUpdateNotification(
  last: string | null,
  next: string | undefined,
  isWorkerUpdate: boolean,
): boolean {
  if (!next || next.includes('__CLEANSTREAM_VERSION__')) return false
  if (isWorkerUpdate) return last !== next
  return Boolean(last && last !== next)
}

export async function showDeviceNotification(input: {
  title: string
  body: string
  version?: string
}): Promise<boolean> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return false
  if (Notification.permission !== 'granted') return false
  const options = {
    body: input.body,
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    tag: UPDATE_TAG,
    renotify: true,
    requireInteraction: true,
    data: { url: '/', version: input.version ?? '' },
  } as NotificationOptions
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready
      await registration.showNotification(input.title, options)
      return true
    }
    new Notification(input.title, options)
    return true
  } catch {
    return false
  }
}

async function fetchVapid(): Promise<VapidResponse> {
  const response = await fetch('/api/updates/vapid', { cache: 'no-store' })
  if (!response.ok) return { configured: false, publicKey: null }
  return (await response.json()) as VapidResponse
}

async function subscribePush(registration: ServiceWorkerRegistration): Promise<boolean> {
  if (!registration.pushManager) return false
  const vapid = await fetchVapid()
  if (!vapid.configured || !vapid.publicKey) return false
  const applicationServerKey = urlBase64ToUint8Array(vapid.publicKey) as BufferSource
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    })
  }
  const response = await fetch('/api/updates/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  })
  if (response.ok) return true
  await subscription.unsubscribe().catch(() => undefined)
  subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  })
  const retry = await fetch('/api/updates/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  })
  return retry.ok
}

async function registerPeriodicSync(registration: ServiceWorkerRegistration): Promise<void> {
  const periodic = (
    registration as ServiceWorkerRegistration & {
      periodicSync?: { register: (tag: string, options: { minInterval: number }) => Promise<void> }
    }
  ).periodicSync
  if (!periodic) return
  try {
    await periodic.register(PERIODIC_SYNC_TAG, { minInterval: PERIODIC_SYNC_MS })
  } catch {
    /* Chrome only grants this for installed PWAs */
  }
}

export async function enableUpdateNotifications(): Promise<{ ok: boolean; message: string }> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return { ok: false, message: 'This browser cannot receive background update notifications.' }
  }
  if (typeof Notification === 'undefined') {
    return { ok: false, message: 'Notifications are not available in this browser.' }
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    localStorage.removeItem(PUSH_ENABLED_KEY)
    return { ok: false, message: 'Notifications are blocked. Enable them in the browser site settings.' }
  }
  const registration = await navigator.serviceWorker.ready
  await registerPeriodicSync(registration)
  const subscribed = await subscribePush(registration)
  localStorage.setItem(PUSH_ENABLED_KEY, '1')
  const shown = await showDeviceNotification({
    title: 'MyTube alerts are on',
    body: 'This phone or computer will get a notification when a new version is published. Tap to open MyTube.',
  })
  return {
    ok: true,
    message: shown
      ? 'Check your notification tray — this device is subscribed to MyTube updates.'
      : subscribed
        ? 'This device will be notified when a new MyTube version is published.'
        : 'Notifications are on. This device will also check for updates in the background when the browser allows it.',
  }
}

export async function registerBackgroundUpdateChecks(registration: ServiceWorkerRegistration): Promise<void> {
  await registerPeriodicSync(registration)
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    await subscribePush(registration)
  } catch {
    /* missing VAPID or a transient network error should not block version polling */
  }
}
