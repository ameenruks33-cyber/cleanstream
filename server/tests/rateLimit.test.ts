import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../app.ts'
import { loadEnv } from '../config/env.ts'

describe('API rate limiting', () => {
  it('rejects a burst of public search requests', async () => {
    const env = loadEnv({
      NODE_ENV: 'test',
      RATE_LIMIT_MAX: '3',
      PORT: '8787',
      APP_URL: 'http://localhost:5173',
    } as NodeJS.ProcessEnv)
    const app = createApp(env)

    await request(app).get('/api/youtube/search?q=blender').expect(200)
    await request(app).get('/api/youtube/search?q=blender').expect(200)
    await request(app).get('/api/youtube/search?q=blender').expect(200)
    const limited = await request(app).get('/api/youtube/search?q=blender')
    expect(limited.status).toBe(429)
    expect(limited.body.code).toBe('RATE_LIMITED')
  })

  it('validates video ids before calling YouTube', async () => {
    const env = loadEnv({ NODE_ENV: 'test', PORT: '8787', APP_URL: 'http://localhost:5173' } as NodeJS.ProcessEnv)
    const app = createApp(env)
    const response = await request(app).get('/api/youtube/videos/nope')
    expect(response.status).toBe(400)
    expect(response.body.code).toBe('INVALID_VIDEO_ID')
  })
})
