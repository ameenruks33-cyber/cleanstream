const CACHE = 'cleanstream-__CLEANSTREAM_VERSION__'
const VERSION_MARKER = 'cleanstream-update-marker'
const APP_VERSION = '__CLEANSTREAM_VERSION__'
const UPDATE_TAG = 'mytube-update'

let replacingWorker = false

self.addEventListener('install', (event) => {
  replacingWorker = Boolean(self.registration.active)
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(['/logo.jpg', '/favicon.png', '/manifest.webmanifest', '/pwa-192.png', '/pwa-512.png']),
      )
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key !== CACHE && key !== VERSION_MARKER).map((key) => caches.delete(key)))
      await self.clients.claim()
      await notifyIfVersionChanged(APP_VERSION, replacingWorker)
      await pingOpenClients()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'cleanstream-version') {
    event.waitUntil(checkPublishedVersion())
  }
})

self.addEventListener('push', (event) => {
  event.waitUntil(handlePush(event))
})

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(resubscribePush())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(openAndRefresh(target))
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return
  if (url.pathname === '/version.json' || url.pathname === '/sw.js') {
    event.respondWith(fetch(request, { cache: 'no-store' }))
    return
  }
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          const copy = response.clone()
          void caches.open(CACHE).then((cache) => cache.put('/index.html', copy))
          return response
        })
        .catch(() => caches.match('/index.html')),
    )
    return
  }
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      if (new URL(request.url).origin !== self.location.origin) return cache.match(request)
      const cached = await cache.match(request)
      const network = fetch(request)
        .then((response) => {
          if (response.ok) void cache.put(request, response.clone())
          return response
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})

async function publishedVersion() {
  const response = await fetch('/version.json', { cache: 'no-store' })
  if (!response.ok) return undefined
  const body = await response.json()
  return typeof body.version === 'string' ? body.version : undefined
}

async function readMarkedVersion() {
  const cache = await caches.open(VERSION_MARKER)
  const previous = await cache.match('version')
  return previous ? previous.text() : null
}

async function writeMarkedVersion(version) {
  const cache = await caches.open(VERSION_MARKER)
  await cache.put('version', new Response(version, { headers: { 'Content-Type': 'text/plain' } }))
}

function shouldNotify(last, next, isWorkerUpdate) {
  if (!next || String(next).includes('__CLEANSTREAM_VERSION__')) return false
  if (isWorkerUpdate) return last !== next
  return Boolean(last && last !== next)
}

async function showUpdateNotification(version, title, body) {
  try {
    await self.registration.showNotification(title || 'MyTube updated', {
      body: body || 'Tap to refresh this phone or computer.',
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      tag: UPDATE_TAG,
      renotify: true,
      requireInteraction: true,
      data: { url: '/', version },
    })
  } catch {
    /* permission not granted yet */
  }
}

async function notifyIfVersionChanged(version, isWorkerUpdate) {
  if (!version || version.includes('__CLEANSTREAM_VERSION__')) return
  const last = await readMarkedVersion()
  if (shouldNotify(last, version, Boolean(isWorkerUpdate))) {
    await showUpdateNotification(version)
  }
  await writeMarkedVersion(version)
}

async function checkPublishedVersion() {
  try {
    await self.registration.update()
    const version = await publishedVersion()
    if (version) await notifyIfVersionChanged(version, replacingWorker || version !== APP_VERSION)
  } catch {
    /* offline devices retry on the next sync */
  }
}

async function handlePush(event) {
  let payload = {
    title: 'MyTube updated',
    body: 'A new version is available. Tap to refresh.',
    url: '/',
    version: APP_VERSION,
  }
  try {
    if (event.data) payload = { ...payload, ...event.data.json() }
  } catch {
    /* keep defaults */
  }
  await writeMarkedVersion(payload.version || APP_VERSION)
  await showUpdateNotification(payload.version || APP_VERSION, payload.title, payload.body)
}

async function pingOpenClients() {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const client of windows) {
    client.postMessage({ type: 'MYTUBE_UPDATED', version: APP_VERSION })
  }
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

async function resubscribePush() {
  try {
    const vapid = await fetch('/api/updates/vapid', { cache: 'no-store' }).then((response) => response.json())
    if (!vapid || !vapid.publicKey) return
    const subscription = await self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
    })
    await fetch('/api/updates/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription.toJSON()),
    })
  } catch {
    /* will retry the next time the app opens */
  }
}

async function openAndRefresh(path) {
  const url = new URL(path, self.location.origin).href
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const client of windows) {
    if ('focus' in client) {
      await client.focus()
      client.postMessage({ type: 'MYTUBE_RELOAD', url })
      return
    }
  }
  if (self.clients.openWindow) await self.clients.openWindow(url)
}
