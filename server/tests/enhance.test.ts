import request from 'supertest'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from '../app.ts'
import { loadEnv } from '../config/env.ts'
import {
  configureEnhanceEngine,
  queueEnhance,
  resetEnhanceEngine,
  youtubeQualityNotice,
} from '../services/enhance/engine.ts'
import { isAllowedRemoteSource } from '../services/enhance/sources.ts'

function testApp() {
  return createApp(
    loadEnv({
      NODE_ENV: 'test',
      PORT: '8787',
      APP_URL: 'http://localhost:5173',
    } as NodeJS.ProcessEnv),
  )
}

afterEach(() => {
  resetEnhanceEngine()
})

describe('4K enhancement policy', () => {
  it('refuses to enhance YouTube streams', async () => {
    const app = testApp()
    const notice = await request(app).get('/api/enhance/quality?source=youtube&id=dQw4w9WgXcQ')
    expect(notice.status).toBe(200)
    expect(notice.body.enhanceable).toBe(false)
    expect(notice.body.player).toBe('official-embed')
    expect(youtubeQualityNotice('dQw4w9WgXcQ').enhanceable).toBe(false)

    const blocked = await request(app).post('/api/enhance').send({ fileId: 'dQw4w9WgXcQ' })
    expect(blocked.status).toBe(400)
    expect(blocked.body.code).toBe('YOUTUBE_NOT_ENHANCEABLE')
  })

  it('rejects path traversal and arbitrary sources', async () => {
    const app = testApp()
    expect(isAllowedRemoteSource('https://evil.example/steal.mp4')).toBe(false)
    expect(isAllowedRemoteSource('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4')).toBe(true)
    const traversal = await request(app).get('/api/enhance/media/..%2F..%2Fetc%2Fpasswd')
    expect(traversal.status).toBeGreaterThanOrEqual(400)
    const missing = await request(app).post('/api/enhance').send({ fileId: 'not-a-real-title' })
    expect(missing.status).toBe(404)
  })

  it('queues authorized files and reuses the job', async () => {
    configureEnhanceEngine({
      binaries: () => ({
        ffmpeg: true,
        ffprobe: true,
        ai: false,
        encoder: 'libx264',
        maxConcurrentJobs: 1,
      }),
      probe: async () => {
        await new Promise((resolve) => setTimeout(resolve, 40))
        return { width: 1280, height: 720, fps: 24, codec: 'h264', durationSeconds: 12 }
      },
      run: async () => 1,
    })
    const first = queueEnhance('big-buck-bunny')
    expect(['queued', 'running']).toContain(first.status)
    const second = queueEnhance('big-buck-bunny')
    expect(second.jobId).toBe(first.jobId)
  })
})
