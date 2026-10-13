import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../app.ts'
import { loadEnv } from '../config/env.ts'

function testApp() {
  return createApp(
    loadEnv({
      NODE_ENV: 'test',
      PORT: '8787',
      APP_URL: 'http://localhost:5173',
    } as NodeJS.ProcessEnv),
  )
}

describe('required APIs remain functional with Ad Shield CSP', () => {
  it('serves health, library, and search validation', async () => {
    const app = testApp()
    const health = await request(app).get('/api/health')
    expect(health.status).toBe(200)
    expect(health.body.ok).toBe(true)

    const library = await request(app).get('/api/library')
    expect(library.status).toBe(200)
    expect(Array.isArray(library.body.items)).toBe(true)

    const invalid = await request(app).get('/api/youtube/videos/nope')
    expect(invalid.status).toBe(400)
  })

  it('rejects foreign origins and requires HTTPS in production', async () => {
    const app = testApp()
    const blocked = await request(app).get('/api/health').set('Origin', 'https://evil.vercel.app')
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined()

    const allowed = await request(app).get('/api/health').set('Origin', 'http://localhost:5173')
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173')

    const prod = createApp(
      loadEnv({
        NODE_ENV: 'production',
        PORT: '8787',
        APP_URL: 'https://cleanstream-two.vercel.app',
      } as NodeJS.ProcessEnv),
    )
    const redirected = await request(prod).get('/api/health').set('X-Forwarded-Proto', 'http').set('Host', 'cleanstream-two.vercel.app')
    expect(redirected.status).toBe(301)
    expect(String(redirected.headers.location)).toMatch(/^https:\/\//)

    const openRedirect = await request(prod).get('/api/health').set('X-Forwarded-Proto', 'http').set('Host', 'evil.example')
    expect(openRedirect.status).toBe(400)

    const secure = await request(prod).get('/api/health').set('X-Forwarded-Proto', 'https')
    expect(secure.status).toBe(200)
    expect(String(secure.headers['strict-transport-security'] ?? '')).toMatch(/max-age=31536000/)
    expect(secure.headers['x-content-type-options']).toBe('nosniff')
    expect(secure.headers['x-frame-options']).toBe('DENY')
  })

  it('does not allow advertising CDNs in CSP and keeps the YouTube frame allowlist', async () => {
    const app = testApp()
    const response = await request(app).get('/api/health')
    const csp = String(response.headers['content-security-policy'] ?? '')
    expect(csp).toMatch(/object-src 'none'/)
    expect(csp).toMatch(/frame-src[^;]*youtube.com/)
    expect(csp).not.toMatch(/googlesyndication/)
    expect(csp).not.toMatch(/doubleclick/)
  })
})
