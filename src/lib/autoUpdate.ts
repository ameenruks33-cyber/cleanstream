import { registerBackgroundUpdateChecks, showDeviceNotification } from '@/lib/deviceUpdates'

export const AUTO_UPDATE_INTERVAL_MS = 60_000
export const VERSION_STORAGE_KEY = 'cleanstream.app-version'

export function shouldReloadForVersion(current: string | null, next: string | undefined): boolean {
  if (!next) return false
  if (!current) return false
  return current !== next
}

function rememberVersion(version: string): void {
  localStorage.setItem(VERSION_STORAGE_KEY, version)
  sessionStorage.setItem(VERSION_STORAGE_KEY, version)
}

export function readRememberedVersion(): string | null {
  const stored = localStorage.getItem(VERSION_STORAGE_KEY) ?? sessionStorage.getItem(VERSION_STORAGE_KEY)
  if (stored && !localStorage.getItem(VERSION_STORAGE_KEY)) {
    localStorage.setItem(VERSION_STORAGE_KEY, stored)
  }
  return stored
}

async function fetchPublishedVersion(): Promise<string | undefined> {
  const response = await fetch('/version.json', { cache: 'no-store' })
  if (!response.ok) return undefined
  const body = (await response.json()) as { version?: string }
  return typeof body.version === 'string' ? body.version : undefined
}

export async function checkPublishedVersion(reload: () => void): Promise<void> {
  const next = await fetchPublishedVersion()
  const current = readRememberedVersion()
  if (!next) return
  if (!current) {
    rememberVersion(next)
    return
  }
  if (shouldReloadForVersion(current, next)) {
    rememberVersion(next)
    await showDeviceNotification({
      title: 'MyTube updated',
      body: 'Tap to open the new version on this device.',
      version: next,
    })
    reload()
  }
}

function listenForServiceWorker(registration: ServiceWorkerRegistration, reload: () => void): void {
  const activateWaiting = (worker: ServiceWorker) => {
    worker.postMessage({ type: 'SKIP_WAITING' })
  }
  if (registration.waiting) activateWaiting(registration.waiting)
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing
    if (!worker) return
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        activateWaiting(worker)
      }
    })
  })
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    reload()
  })
}

export async function startAutoUpdate(): Promise<void> {
  if (typeof window === 'undefined') return
  let reloading = false
  const reload = () => {
    if (reloading) return
    reloading = true
    window.location.reload()
  }

  window.addEventListener('appinstalled', () => {
    void import('@/lib/deviceUpdates').then(({ enableUpdateNotifications }) => {
      void enableUpdateNotifications()
    })
  })

  const poll = () => {
    void checkPublishedVersion(reload)
    if (navigator.serviceWorker?.controller) {
      void navigator.serviceWorker.getRegistration().then((registration) => registration?.update())
    }
  }

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      })
      listenForServiceWorker(registration, reload)
      void registration.update()
      void registerBackgroundUpdateChecks(registration)
      navigator.serviceWorker.addEventListener('message', (event: MessageEvent<{ type?: string; version?: string }>) => {
        if (event.data?.type === 'MYTUBE_RELOAD') reload()
        if (event.data?.type === 'MYTUBE_UPDATED') {
          void showDeviceNotification({
            title: 'MyTube updated',
            body: 'Tap to open the new version on this device.',
            version: event.data.version,
          })
        }
      })
    } catch {
      /* Browsers without a secure context cannot register a worker. Version polling still runs. */
    }
  }

  void checkPublishedVersion(reload)
  window.setInterval(poll, AUTO_UPDATE_INTERVAL_MS)
  window.addEventListener('focus', poll)
  window.addEventListener('pageshow', poll)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') poll()
  })
}
