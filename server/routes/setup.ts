import { Router } from 'express'
import { z } from 'zod'
import {
  YOUTUBE_API_KEY_RE,
  isTmdbConfigured,
  isYoutubeConfigured,
  normalizeTmdbApiKey,
  persistTmdbApiKey,
  persistYoutubeApiKey,
  type Env,
} from '../config/env.ts'

const BodySchema = z.object({
  apiKey: z.string().trim().min(20).max(80),
})

function isLoopback(ip: string | undefined): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'
}

export function setupRouter(env: Env): Router {
  const router = Router()

  router.post('/youtube-key', (req, res) => {
    if (env.NODE_ENV === 'production') {
      res.status(403).json({
        error: 'Set YOUTUBE_API_KEY on the server environment in production.',
        code: 'FORBIDDEN',
      })
      return
    }
    if (!isLoopback(req.ip)) {
      res.status(403).json({ error: 'This setup endpoint is local-only.', code: 'FORBIDDEN' })
      return
    }
    const parsed = BodySchema.safeParse(req.body)
    if (!parsed.success || !YOUTUBE_API_KEY_RE.test(parsed.data.apiKey)) {
      res.status(400).json({
        error: 'That does not look like a YouTube Data API key (it usually starts with AIza).',
        code: 'INVALID_KEY',
      })
      return
    }
    persistYoutubeApiKey(env, parsed.data.apiKey)
    res.json({ ok: true, youtubeConfigured: isYoutubeConfigured(env) })
  })

  router.post('/tmdb-key', (req, res) => {
    if (env.NODE_ENV === 'production') {
      res.status(403).json({
        error: 'Set TMDB_API_KEY on the server environment in production.',
        code: 'FORBIDDEN',
      })
      return
    }
    if (!isLoopback(req.ip)) {
      res.status(403).json({ error: 'This setup endpoint is local-only.', code: 'FORBIDDEN' })
      return
    }
    const parsed = z.object({ apiKey: z.string().trim().min(16).max(4096) }).safeParse(req.body)
    const apiKey = parsed.success ? normalizeTmdbApiKey(parsed.data.apiKey) : null
    if (!apiKey) {
      res.status(400).json({
        error: 'Paste the TMDB API Key (32-character v3 key), not the API Read Access Token.',
        code: 'INVALID_KEY',
      })
      return
    }
    persistTmdbApiKey(env, apiKey)
    res.json({ ok: true, tmdbConfigured: isTmdbConfigured(env) })
  })

  return router
}
