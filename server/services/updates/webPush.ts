import webpush from 'web-push'
import type { Env } from '../../config/env.ts'
import { persistEnvValue } from '../../config/env.ts'
import {
  isPublicHttpsEndpoint,
  listPushSubscriptions,
  removePushSubscription,
  type PushSubscriptionRecord,
} from './subscriptions.ts'

const VAPID_PUBLIC_RE = /^[A-Za-z0-9_-]{80,200}$/
const VAPID_PRIVATE_RE = /^[A-Za-z0-9_-]{20,200}$/

export function vapidConfigured(env: Env): boolean {
  return VAPID_PUBLIC_RE.test(env.VAPID_PUBLIC_KEY) && VAPID_PRIVATE_RE.test(env.VAPID_PRIVATE_KEY)
}

export function ensureVapidKeys(env: Env): boolean {
  if (vapidConfigured(env)) return true
  if (env.NODE_ENV === 'production' || env.NODE_ENV === 'test') return false
  const keys = webpush.generateVAPIDKeys()
  persistEnvValue(env, 'VAPID_PUBLIC_KEY', keys.publicKey)
  persistEnvValue(env, 'VAPID_PRIVATE_KEY', keys.privateKey)
  if (!env.VAPID_SUBJECT || env.VAPID_SUBJECT === 'mailto:support@localhost') {
    persistEnvValue(env, 'VAPID_SUBJECT', 'mailto:support@localhost')
  }
  return vapidConfigured(env)
}

function vapidSubject(env: Env): string {
  const subject = env.VAPID_SUBJECT.trim()
  if (subject.startsWith('mailto:') || subject.startsWith('https://')) return subject
  return 'mailto:support@localhost'
}

export type UpdatePushPayload = {
  title: string
  body: string
  url: string
  version: string
}

export async function sendUpdatePush(env: Env, payload: UpdatePushPayload): Promise<{ sent: number; removed: number }> {
  if (!vapidConfigured(env)) return { sent: 0, removed: 0 }
  webpush.setVapidDetails(vapidSubject(env), env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY)
  const body = JSON.stringify({
    title: payload.title.slice(0, 80),
    body: payload.body.slice(0, 180),
    url: payload.url.startsWith('/') ? payload.url : '/',
    version: payload.version.slice(0, 80),
  })
  let sent = 0
  let removed = 0
  for (const subscription of listPushSubscriptions()) {
    try {
      await webpush.sendNotification(toWebPushSubscription(subscription), body, { TTL: 60 * 60 * 24 })
      sent += 1
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        removePushSubscription(subscription.endpoint)
        removed += 1
      }
    }
  }
  return { sent, removed }
}

function toWebPushSubscription(record: PushSubscriptionRecord) {
  return {
    endpoint: record.endpoint,
    expirationTime: record.expirationTime,
    keys: record.keys,
  }
}

export { isPublicHttpsEndpoint }
