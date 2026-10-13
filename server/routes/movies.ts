import { Router } from 'express'
import { z } from 'zod'
import { isWatchRegion } from '../../src/data/watchRegions.ts'
import { validateLanguageCode, validateMovieId, validateReleaseYear, validateSearchQuery } from '../../src/lib/validation.ts'
import type { Env } from '../config/env.ts'
import { cronAuthorized } from '../lib/cronAuth.ts'
import { getMovieEngine } from '../services/movies/engine.ts'
import { movieJobStatus } from '../services/movies/jobs.ts'

const SearchQuerySchema = z.object({
  q: z.string().optional().default(''),
  year: z.string().optional(),
  language: z.string().optional(),
  originalLanguage: z.string().optional(),
  country: z.string().optional(),
  page: z.coerce.number().int().min(1).max(20).optional().default(1),
})

const RefreshSchema = z.object({
  ids: z.array(z.string().min(1).max(20)).max(20),
  country: z.string().optional(),
  previous: z.record(z.string(), z.string()).optional(),
})

export function moviesRouter(env: Env): Router {
  const router = Router()
  const engine = getMovieEngine(env)

  router.get('/regions', (_req, res) => {
    res.json(engine.regions())
  })

  router.get('/search', async (req, res, next) => {
    try {
      const parsed = SearchQuerySchema.safeParse(req.query)
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid movie search request.', code: 'INVALID_QUERY' })
        return
      }
      const query = validateSearchQuery(parsed.data.q)
      if (!query.ok) {
        res.status(400).json({ error: query.error, code: query.code })
        return
      }
      let year: number | undefined
      if (parsed.data.year) {
        const parsedYear = validateReleaseYear(parsed.data.year)
        if (!parsedYear.ok) {
          res.status(400).json({ error: parsedYear.error, code: parsedYear.code })
          return
        }
        year = parsedYear.value
      }
      let language: string | undefined
      if (parsed.data.language) {
        const parsedLanguage = validateLanguageCode(parsed.data.language)
        if (!parsedLanguage.ok) {
          res.status(400).json({ error: parsedLanguage.error, code: parsedLanguage.code })
          return
        }
        language = parsedLanguage.value
      }
      let originalLanguage: string | undefined
      if (parsed.data.originalLanguage) {
        const parsedOriginal = validateLanguageCode(parsed.data.originalLanguage)
        if (!parsedOriginal.ok) {
          res.status(400).json({ error: parsedOriginal.error, code: parsedOriginal.code })
          return
        }
        originalLanguage = parsedOriginal.value
      }
      const country = parsed.data.country?.trim().toUpperCase()
      if (country && !isWatchRegion(country)) {
        res.status(400).json({ error: 'That country is not in the watch-region list.', code: 'INVALID_COUNTRY' })
        return
      }
      const result = await engine.search({
        query: query.value,
        year,
        language,
        originalLanguage,
        page: parsed.data.page,
        country,
      })
      res.json(result)
    } catch (error) {
      next(error)
    }
  })

  router.get('/jobs/refresh', (req, res) => {
    if (!cronAuthorized(req, env)) {
      res.status(401).json({ error: 'Cron secret required.', code: 'CRON_UNAUTHORIZED' })
      return
    }
    res.json({ ok: true, job: movieJobStatus() })
  })

  router.post('/refresh', async (req, res, next) => {
    try {
      const parsed = RefreshSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid refresh request.', code: 'INVALID_REFRESH' })
        return
      }
      const country = parsed.data.country?.trim().toUpperCase()
      if (country && !isWatchRegion(country)) {
        res.status(400).json({ error: 'That country is not in the watch-region list.', code: 'INVALID_COUNTRY' })
        return
      }
      const ids = parsed.data.ids.flatMap((raw) => {
        const id = validateMovieId(raw)
        return id.ok ? [id.value] : []
      })
      const result = await engine.refreshWatchlist({
        ids,
        country,
        previous: parsed.data.previous,
      })
      res.json({ ...result, job: movieJobStatus() })
    } catch (error) {
      next(error)
    }
  })

  router.get('/:id', async (req, res, next) => {
    try {
      const id = validateMovieId(String(req.params.id ?? ''))
      if (!id.ok) {
        res.status(400).json({ error: id.error, code: id.code })
        return
      }
      const country = typeof req.query.country === 'string' ? req.query.country.trim().toUpperCase() : undefined
      if (country && !isWatchRegion(country)) {
        res.status(400).json({ error: 'That country is not in the watch-region list.', code: 'INVALID_COUNTRY' })
        return
      }
      let language: string | undefined
      if (typeof req.query.language === 'string' && req.query.language) {
        const parsedLanguage = validateLanguageCode(req.query.language)
        if (!parsedLanguage.ok) {
          res.status(400).json({ error: parsedLanguage.error, code: parsedLanguage.code })
          return
        }
        language = parsedLanguage.value
      }
      const movie = await engine.getMovie(id.value, country, language)
      res.json({ movie })
    } catch (error) {
      next(error)
    }
  })

  return router
}
