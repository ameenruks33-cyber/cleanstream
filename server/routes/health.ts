import { Router } from 'express'
import type { Env } from '../config/env.ts'
import { isYoutubeConfigured } from '../config/env.ts'
import { detectBinaries } from '../services/enhance/engine.ts'

export function healthRouter(env: Env): Router {
  const router = Router()
  router.get('/', (_req, res) => {
    const enhance = detectBinaries()
    res.json({
      ok: true,
      name: 'mytube',
      youtubeConfigured: isYoutubeConfigured(env),
      supabaseConfigured: Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY),
      enhance,
    })
  })
  return router
}
