import request from 'supertest'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from '../app.ts'
import { loadEnv } from '../config/env.ts'
import { enqueueTranslationJob, getTranslationJob, resetVideoLanguageJobs } from '../services/videoLanguage/jobs.ts'

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
  resetVideoLanguageJobs()
})

describe('video language API', () => {
  it('returns a cached Malayalam subtitle track for licensed catalog titles', async () => {
    const app = testApp()
    const response = await request(app).post('/api/video-language').send({
      videoId: 'big-buck-bunny',
      language: 'ml',
      mode: 'subtitles',
    })
    expect(response.status).toBe(200)
    expect(response.body.status).toBe('ready')
    expect(response.body.trackUrl).toBe('/api/video-language/media/big-buck-bunny/ml.vtt')
    expect(response.body.cues?.[0]?.text).toMatch(/ബിഗ് ബക്ക് ബണ്ണി/)

    const vtt = await request(app).get('/api/video-language/media/big-buck-bunny/ml.vtt')
    expect(vtt.status).toBe(200)
    expect(vtt.headers['content-type']).toMatch(/text\/vtt/)
    expect(vtt.text).toContain('WEBVTT')
    expect(vtt.text).toContain('00:00:00.000 --> 00:00:04.000')
    expect(vtt.text).toMatch(/ബിഗ് ബക്ക് ബണ്ണി/)
  })

  it('returns ready dubbed tracks with cues for browser voice playback', async () => {
    const app = testApp()
    const response = await request(app).post('/api/video-language').send({
      videoId: 'sintel',
      language: 'ta',
      mode: 'dubbed',
    })
    expect(response.status).toBe(200)
    expect(response.body.status).toBe('ready')
    expect(response.body.mode).toBe('dubbed')
    expect(response.body.cues?.length).toBeGreaterThan(0)
    expect(response.body.cues[0].text).toMatch(/சின்டெல்/)
  })

  it('refuses YouTube ids and unknown titles', async () => {
    const app = testApp()
    const youtube = await request(app).post('/api/video-language').send({
      videoId: 'dQw4w9WgXcQ',
      language: 'en',
      mode: 'subtitles',
    })
    expect(youtube.status).toBe(404)
    expect(youtube.body.code).toBe('YOUTUBE_NOT_TRANSLATABLE')

    const missing = await request(app).post('/api/video-language').send({
      videoId: 'not-a-real-title',
      language: 'hi',
      mode: 'subtitles',
    })
    expect(missing.status).toBe(404)
    expect(missing.body.code).toBe('NOT_FOUND')
  })

  it('rejects invalid settings and path traversal', async () => {
    const app = testApp()
    const invalid = await request(app).post('/api/video-language').send({
      videoId: 'big-buck-bunny',
      language: 'xx',
      mode: 'subtitles',
    })
    expect(invalid.status).toBe(400)

    const traversal = await request(app).get('/api/video-language/media/..%2F..%2Fetc%2Fpasswd/en.vtt')
    expect(traversal.status).toBeGreaterThanOrEqual(400)
  })

  it('queues then fails when no authorized transcript exists', async () => {
    const job = await enqueueTranslationJob({
      videoId: 'missing-title',
      language: 'en',
      mode: 'subtitles',
    })
    expect(job.status).toBe('queued')
    await Promise.resolve()
    expect(getTranslationJob(job.jobId)?.status).toBe('failed')
  })
})
