import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseYoutubeError, searchYoutube, getYoutubeVideo, clearYoutubeCache } from '../services/youtube.ts'
import type { Env } from '../config/env.ts'

const baseEnv: Env = {
  PORT: 8787,
  APP_URL: 'http://localhost:5173',
  YOUTUBE_API_KEY: '',
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  SUPABASE_SERVICE_ROLE_KEY: '',
  NODE_ENV: 'test',
  TMDB_API_KEY: '',
  JUSTWATCH_PARTNER_TOKEN: '',
  MOVIE_CRON_SECRET: '',
  DEFAULT_WATCH_REGION: 'AE',
  VAPID_PUBLIC_KEY: '',
  VAPID_PRIVATE_KEY: '',
  VAPID_SUBJECT: 'mailto:support@localhost',
}

afterEach(() => {
  vi.unstubAllGlobals()
  clearYoutubeCache()
})

describe('YouTube error mapping', () => {
  it('maps quota exhaustion', () => {
    const error = parseYoutubeError(403, {
      error: { message: 'quota exceeded', errors: [{ reason: 'quotaExceeded' }] },
    })
    expect(error.code).toBe('QUOTA_EXCEEDED')
    expect(error.status).toBe(429)
  })
})

describe('YouTube search service', () => {
  it('returns live catalog videos when unconfigured', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('invidious.f5.si')) {
          return {
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify([
                {
                  type: 'video',
                  title: 'Solo Trip to Kerala | VARKALA',
                  videoId: 'c1tCK4WMJu0',
                  author: 'Ghumnewala',
                  authorId: 'UCexamplechan',
                  published: 1_700_000_000,
                  lengthSeconds: 754,
                  viewCount: 12000,
                },
              ]),
          }
        }
        return { ok: false, status: 502, text: async () => '' }
      }),
    )
    const result = await searchYoutube(baseEnv, 'varkala')
    expect(result.mock).toBeUndefined()
    expect(result.items[0]?.id).toBe('c1tCK4WMJu0')
    expect(result.items[0]?.title).toContain('VARKALA')
    expect(result.items[0]?.thumbnailUrl).toBe('https://i.ytimg.com/vi/c1tCK4WMJu0/hqdefault.jpg')
    expect(result.items[0]?.duration).toBe('12:34')
  })

  it('falls back to sample matches when catalog search is offline', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )
    const result = await searchYoutube(baseEnv, 'blender')
    expect(result.mock).toBe(true)
    expect(result.items.length).toBeGreaterThan(0)
  })

  it('keeps the official player available when oEmbed forbids embedding', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 401,
      })),
    )
    const video = await getYoutubeVideo(baseEnv, 'c1tCK4WMJu0')
    expect(video?.embeddable).toBe(true)
    expect(video?.title).not.toBe('This video cannot be embedded')
  })

  it('omits search results YouTube will not embed when playable matches exist', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('invidious.f5.si')) {
          return {
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify([
                { type: 'video', title: 'Blocked trip', videoId: 'c1tCK4WMJu0', author: 'Ghumnewala' },
                { type: 'video', title: 'Varkala Retreat', videoId: 'k_ufLLasmRY', author: 'Gom Yang' },
              ]),
          }
        }
        if (url.includes('oembed') && url.includes('c1tCK4WMJu0')) {
          return { ok: false, status: 401 }
        }
        if (url.includes('oembed')) {
          return { ok: true, status: 200, json: async () => ({ title: 'ok' }) }
        }
        return { ok: false, status: 502, text: async () => '' }
      }),
    )
    const result = await searchYoutube(baseEnv, 'varkala')
    expect(result.items.map((item) => item.id)).toEqual(['k_ufLLasmRY'])
  })

  it('resolves any public video id through oEmbed when unconfigured', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          title: 'Never Gonna Give You Up',
          author_name: 'Rick Astley',
          thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        }),
      })),
    )
    const video = await getYoutubeVideo(baseEnv, 'dQw4w9WgXcQ')
    expect(video?.title).toBe('Never Gonna Give You Up')
    expect(video?.embeddable).toBe(true)
  })

  it('surfaces API failures without leaking the key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 403,
        json: async () => ({
          error: {
            message: 'The request cannot be completed because you have exceeded your quota.',
            errors: [{ reason: 'quotaExceeded' }],
          },
        }),
      })),
    )
    await expect(
      searchYoutube({ ...baseEnv, YOUTUBE_API_KEY: 'test-key-123456' }, 'cats'),
    ).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' })
  })
})
