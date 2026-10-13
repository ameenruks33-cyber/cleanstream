import cors from 'cors'
import helmet from 'helmet'
import type { Express } from 'express'
import type { Env } from '../config/env.ts'

const LOCAL_APP_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8787',
]

export function isAllowedOrigin(origin: string | undefined, env: Env): boolean {
  if (!origin) return true
  if (origin === env.APP_URL) return true
  if (LOCAL_APP_ORIGINS.includes(origin)) return true
  try {
    const url = new URL(origin)
    if (url.protocol !== 'https:') return false
    const host = url.hostname
    if (host === 'cleanstream-two.vercel.app') return true
    return (
      /^cleanstream-[a-z0-9]+-ameenruks33-cybers-projects\.vercel\.app$/.test(host) ||
      /^cleanstream-git-[a-z0-9-]+-ameenruks33-cybers-projects\.vercel\.app$/.test(host)
    )
  } catch {
    return false
  }
}

export function contentSecurityPolicy(env: Env) {
  const connectSrc = ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co']
  if (env.NODE_ENV !== 'production') connectSrc.push('http://127.0.0.1:8787')
  return {
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
        'https://yt3.googleusercontent.com',
        'https://commondatastorage.googleapis.com',
        'https://image.tmdb.org',
        'https://media.themoviedb.org',
        'https://www.themoviedb.org',
        'https://commons.wikimedia.org',
        'https://upload.wikimedia.org',
      ],
      mediaSrc: ["'self'", 'blob:', 'https://commondatastorage.googleapis.com'],
      frameSrc: ["'self'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com'],
      connectSrc,
      objectSrc: ["'none'"],
      workerSrc: ["'self'"],
      manifestSrc: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: env.NODE_ENV === 'production' ? [] : null,
    },
  }
}

export function applySecurity(app: Express, env: Env): void {
  app.disable('x-powered-by')
  app.use(
    helmet({
      contentSecurityPolicy: contentSecurityPolicy(env),
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'same-origin' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      frameguard: { action: 'deny' },
      noSniff: true,
      hsts:
        env.NODE_ENV === 'production'
          ? { maxAge: 31536000, includeSubDomains: true, preload: true }
          : false,
      permissionsPolicy: {
        camera: [],
        microphone: [],
        geolocation: [],
        payment: [],
        usb: [],
        bluetooth: [],
        notifications: ['self'],
        autoplay: ['self', 'https://www.youtube.com'],
        fullscreen: ['self', 'https://www.youtube.com'],
      },
    }),
  )
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, isAllowedOrigin(origin, env))
      },
      credentials: false,
      methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Accept', 'X-Cron-Secret'],
      maxAge: 600,
    }),
  )
}
