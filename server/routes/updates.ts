import { Router } from 'express'
import { z } from 'zod'
import type { Env } from '../config/env.ts'
import { cronAuthorized } from '../lib/cronAuth.ts'
import { getUpdateManifest } from '../services/updates/manifest.ts'
import { removePushSubscription, savePushSubscription } from '../services/updates/subscriptions.ts'
import { ensureVapidKeys, isPublicHttpsEndpoint, sendUpdatePush, vapidConfigured } from '../services/updates/webPush.ts'

const SubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(20).max(512),
    auth: z.string().min(8).max(256),
  }),
})

const UnsubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
})

export function updatesRouter(env: Env): Router {
  const router = Router()

  router.get('/manifest', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.json(getUpdateManifest(vapidConfigured(env) || ensureVapidKeys(env)))
  })

  router.get('/vapid', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    const configured = vapidConfigured(env) || ensureVapidKeys(env)
    res.json({
      configured,
      publicKey: configured ? env.VAPID_PUBLIC_KEY : null,
    })
  })

  router.post('/subscribe', (req, res) => {
    if (!(vapidConfigured(env) || ensureVapidKeys(env))) {
      res.status(503).json({ error: 'Web Push is not configured on this server.', code: 'PUSH_NOT_CONFIGURED' })
      return
    }
    const parsed = SubscriptionSchema.safeParse(req.body)
    if (!parsed.success || !isPublicHttpsEndpoint(parsed.data.endpoint)) {
      res.status(400).json({ error: 'Invalid push subscription.', code: 'INVALID_SUBSCRIPTION' })
      return
    }
    const count = savePushSubscription({
      endpoint: parsed.data.endpoint,
      expirationTime: parsed.data.expirationTime ?? null,
      keys: parsed.data.keys,
      createdAt: new Date().toISOString(),
    })
    res.json({ ok: true, devices: count })
  })

  router.post('/unsubscribe', (req, res) => {
    const parsed = UnsubscribeSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid push subscription.', code: 'INVALID_SUBSCRIPTION' })
      return
    }
    const count = removePushSubscription(parsed.data.endpoint)
    res.json({ ok: true, devices: count })
  })

  router.post('/notify', async (req, res, next) => {
    try {
      if (!cronAuthorized(req, env)) {
        res.status(401).json({ error: 'Cron secret required.', code: 'CRON_UNAUTHORIZED' })
        return
      }
      const manifest = getUpdateManifest(vapidConfigured(env))
      const result = await sendUpdatePush(env, {
        title: 'MyTube updated',
        body: 'A new version is available. Tap to refresh this device.',
        url: '/',
        version: manifest.version,
      })
      res.json({ ok: true, version: manifest.version, ...result })
    } catch (error) {
      next(error)
    }
  })

  return router
}
