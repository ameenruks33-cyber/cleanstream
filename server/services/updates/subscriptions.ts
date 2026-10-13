import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

export type PushSubscriptionRecord = {
  endpoint: string
  expirationTime: number | null
  keys: { p256dh: string; auth: string }
  createdAt: string
}

const MAX_SUBSCRIPTIONS = 4000

type PushGlobal = typeof globalThis & { __mytubePushSubscriptions?: PushSubscriptionRecord[] }

function memoryStore(): PushSubscriptionRecord[] {
  const g = globalThis as PushGlobal
  if (!g.__mytubePushSubscriptions) g.__mytubePushSubscriptions = []
  return g.__mytubePushSubscriptions
}

function storePath(): string {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return join(tmpdir(), 'mytube-push-subscriptions-test.json')
  }
  if (process.env.VERCEL) return join('/tmp', 'mytube-push-subscriptions.json')
  return join(process.cwd(), 'data', 'push-subscriptions.json')
}

function mergeRecords(groups: PushSubscriptionRecord[][]): PushSubscriptionRecord[] {
  const byEndpoint = new Map<string, PushSubscriptionRecord>()
  for (const group of groups) {
    for (const item of group) byEndpoint.set(item.endpoint, item)
  }
  return [...byEndpoint.values()].slice(0, MAX_SUBSCRIPTIONS)
}

function readAll(): PushSubscriptionRecord[] {
  const file = storePath()
  let fromFile: PushSubscriptionRecord[] = []
  if (existsSync(file)) {
    try {
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as unknown
      if (Array.isArray(parsed)) fromFile = parsed.filter(isSubscriptionRecord)
    } catch {
      fromFile = []
    }
  }
  return mergeRecords([memoryStore(), fromFile])
}

function writeAll(items: PushSubscriptionRecord[]): void {
  const next = items.slice(0, MAX_SUBSCRIPTIONS)
  const g = globalThis as PushGlobal
  g.__mytubePushSubscriptions = next
  const file = storePath()
  try {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, `${JSON.stringify(next)}\n`, 'utf8')
  } catch {
    /* serverless filesystems can be read-only besides /tmp */
  }
}

function isSubscriptionRecord(value: unknown): value is PushSubscriptionRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as PushSubscriptionRecord
  return (
    typeof record.endpoint === 'string' &&
    Boolean(record.keys) &&
    typeof record.keys.p256dh === 'string' &&
    typeof record.keys.auth === 'string'
  )
}

export function clearPushSubscriptions(): void {
  writeAll([])
}

export function listPushSubscriptions(): PushSubscriptionRecord[] {
  return readAll()
}

export function savePushSubscription(record: PushSubscriptionRecord): number {
  const items = readAll().filter((item) => item.endpoint !== record.endpoint)
  items.push(record)
  writeAll(items)
  return items.length
}

export function removePushSubscription(endpoint: string): number {
  const items = readAll().filter((item) => item.endpoint !== endpoint)
  writeAll(items)
  return items.length
}

export function isPublicHttpsEndpoint(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  if (url.username || url.password) return false
  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost')) return false
  if (host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') return false
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false
  return url.pathname.length > 1 && url.pathname.length < 2048
}
