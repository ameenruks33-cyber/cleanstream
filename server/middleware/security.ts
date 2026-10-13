import cors from 'cors'
import helmet from 'helmet'
import type { Express } from 'express'
import type { Env } from '../config/env.ts'

function isAllowedOrigin(origin: string | undefined, env: Env): boolean {
  if (!origin) return true
  if (origin === env.APP_URL) return true
  if (origin === 'http://localhost:5173' || origin === 'http://127.0.0.1:5173') return true
  try {
    const host = new URL(origin).hostname
    return origin.startsWith('https://') && host.endsWith('.vercel.app')
  } catch {
    return false
  }
}

export function applySecurity(app: Express, env: Env): void {
  app.disable('x-powered-by')
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: [
            "'self'",
            'data:',
            'blob:',
            'https://i.ytimg.com',
            'https://yt3.ggpht.com',
            'https://commondatastorage.googleapis.com',
          ],
          mediaSrc: ["'self'", 'blob:', 'https://commondatastorage.googleapis.com'],
          frameSrc: ["'self'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com'],
          connectSrc: ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co', 'http://127.0.0.1:8787'],
          objectSrc: ["'none'"],
          workerSrc: ["'self'", 'blob:'],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: env.NODE_ENV === 'production' ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  )
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, isAllowedOrigin(origin, env))
      },
      credentials: false,
    }),
  )
}
