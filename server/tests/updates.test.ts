import { afterEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import webpush from 'web-push'
import { createApp } from '../app.ts'
import { loadEnv } from '../config/env.ts'
import { clearPushSubscriptions } from '../services/updates/subscriptions.ts'

function updatesApp(extra: Record<string, string> = {}) {
  return createApp(
    loadEnv({
      NODE_ENV: 'test',
      PORT: '8787',
      APP_URL: 'http://localhost:5173',
      ...extra,
    } as NodeJS.ProcessEnv),
  )
}

afterEach(() => {
  clearPushSubscriptions()
})

describe('device update API', () => {
  it('exposes a version manifest without requiring push keys', async () => {
    const response = await request(updatesApp()).get('/api/updates/manifest')
    expect(response.status).toBe(200)
    expect(response.body.channel).toBe('web')
    expect(response.body.delivery.web).toMatch(/version.json/)
    expect(response.body.delivery.android).toMatch(/Play Store/)
    expect(response.body.pushConfigured).toBe(false)
  })

  it('rejects a private push endpoint and accepts a public HTTPS subscription', async () => {
    const keys = webpush.generateVAPIDKeys()
    const app = updatesApp({
      VAPID_PUBLIC_KEY: keys.publicKey,
      VAPID_PRIVATE_KEY: keys.privateKey,
      VAPID_SUBJECT: 'mailto:support@localhost',
    })
    const denied = await request(app)
      .post('/api/updates/subscribe')
      .send({
        endpoint: 'http://127.0.0.1/push',
        keys: { p256dh: 'dGVzdC1wdWJsaWMta2V5LWZvci1zdWI', auth: 'dGVzdC1hdXRo' },
      })
    expect(denied.status).toBe(400)

    const saved = await request(app)
      .post('/api/updates/subscribe')
      .send({
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-subscription',
        keys: { p256dh: 'dGVzdC1wdWJsaWMta2V5LWZvci1zdWI', auth: 'dGVzdC1hdXRo' },
      })
    expect(saved.status).toBe(200)
    expect(saved.body.devices).toBe(1)
  })

  it('does not generate VAPID keys in production-like test env', async () => {
    const response = await request(updatesApp()).get('/api/updates/vapid')
    expect(response.status).toBe(200)
    expect(response.body.configured).toBe(false)
    expect(response.body.publicKey).toBeNull()
  })
})
