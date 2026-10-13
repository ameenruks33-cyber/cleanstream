import { Router } from 'express'
import type { Env } from '../config/env.ts'
import { isJustWatchPartnerConfigured, isTmdbConfigured, isYoutubeConfigured } from '../config/env.ts'
import { detectBinaries } from '../services/enhance/engine.ts'
import { movieJobStatus } from '../services/movies/jobs.ts'
import { vapidConfigured } from '../services/updates/webPush.ts'

export function healthRouter(env: Env): Router {
  const router = Router()
  router.get('/', (_req, res) => {
    const enhance = detectBinaries()
    res.json({
      ok: true,
      name: 'mytube',
      youtubeConfigured: isYoutubeConfigured(env),
      moviesConfigured: true,
      tmdbConfigured: isTmdbConfigured(env),
      justWatchPartnerConfigured: isJustWatchPartnerConfigured(env),
      supabaseConfigured: Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY),
      enhance,
      movieJobs: movieJobStatus(),
      pushConfigured: vapidConfigured(env),
    })
  })
  return router
}
