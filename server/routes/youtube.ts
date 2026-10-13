import { Router } from 'express'
import { z } from 'zod'
import { validateSearchQuery, validateYoutubeVideoId } from '../../src/lib/validation.ts'
import type { Env } from '../config/env.ts'
import { getYoutubeVideo, searchYoutube } from '../services/youtube.ts'

const QuerySchema = z.object({
  q: z.string().optional().default(''),
  pageToken: z.string().optional(),
  type: z.enum(['video', 'channel', 'all']).optional().default('video'),
})

export function youtubeRouter(env: Env): Router {
  const router = Router()

  router.get('/search', async (req, res, next) => {
    try {
      const parsed = QuerySchema.safeParse(req.query)
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid search request.', code: 'INVALID_QUERY' })
        return
      }
      const query = validateSearchQuery(parsed.data.q)
      if (!query.ok) {
        res.status(400).json({ error: query.error, code: query.code })
        return
      }
      const result = await searchYoutube(env, query.value, parsed.data.pageToken, parsed.data.type)
      res.json(result)
    } catch (error) {
      next(error)
    }
  })

  router.get('/videos/:id', async (req, res, next) => {
    try {
      const id = validateYoutubeVideoId(String(req.params.id ?? ''))
      if (!id.ok) {
        res.status(400).json({ error: id.error, code: id.code })
        return
      }
      const video = await getYoutubeVideo(env, id.value)
      if (!video) {
        res.status(404).json({ error: 'Video not found or is unavailable.', code: 'VIDEO_NOT_FOUND' })
        return
      }
      res.json({ video })
    } catch (error) {
      next(error)
    }
  })

  return router
}
