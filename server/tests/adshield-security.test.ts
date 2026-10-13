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
