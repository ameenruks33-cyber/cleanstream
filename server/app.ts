import { existsSync } from 'node:fs'
import { join } from 'node:path'
import express from 'express'
import helmet from 'helmet'
import { applySecurity } from './middleware/security.ts'
import { httpsOnly } from './middleware/httpsOnly.ts'
import { createApiLimiter } from './middleware/rateLimit.ts'
import { errorHandler, notFound } from './middleware/errorHandler.ts'
import { youtubeRouter } from './routes/youtube.ts'
import { libraryRouter } from './routes/library.ts'
import { healthRouter } from './routes/health.ts'
import { setupRouter } from './routes/setup.ts'
import { enhanceRouter } from './routes/enhance.ts'
import { moviesRouter } from './routes/movies.ts'
import { updatesRouter } from './routes/updates.ts'
import { videoLanguageRouter } from './routes/videoLanguage.ts'
import type { Env } from './config/env.ts'

export function createApp(env: Env) {
  const app = express()
  app.set('trust proxy', 1)
  app.use(httpsOnly(env))
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }))
  applySecurity(app, env)
  app.use(express.json({ limit: '32kb', strict: true }))

  app.use('/api', createApiLimiter(env))
  app.use('/api/health', healthRouter(env))
  app.use('/api/setup', setupRouter(env))
  app.use('/api/youtube', youtubeRouter(env))
  app.use('/api/library', libraryRouter())
  app.use('/api/enhance', enhanceRouter())
  app.use('/api/movies', moviesRouter(env))
  app.use('/api/updates', updatesRouter(env))
  app.use('/api/video-language', videoLanguageRouter())
  app.use('/api', notFound)

  const dist = join(process.cwd(), 'dist')
  if (env.NODE_ENV === 'production' && existsSync(dist)) {
    app.use(express.static(dist))
    app.get(/.*/, (_req, res) => {
      res.sendFile(join(dist, 'index.html'))
    })
  } else {
    app.use(notFound)
  }

  app.use(errorHandler)
  return app
}
