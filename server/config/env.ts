import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'

const EnvSchema = z.object({
  PORT: z.coerce.number().default(8787),
  APP_URL: z.string().default('http://localhost:5173'),
  YOUTUBE_API_KEY: z.string().optional().default(''),
  SUPABASE_URL: z.string().optional().default(''),
  SUPABASE_ANON_KEY: z.string().optional().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(''),
  NODE_ENV: z.string().optional().default('development'),
  RATE_LIMIT_MAX: z.coerce.number().optional(),
  TMDB_API_KEY: z.string().optional().default(''),
  JUSTWATCH_PARTNER_TOKEN: z.string().optional().default(''),
  MOVIE_CRON_SECRET: z.string().optional().default(''),
  DEFAULT_WATCH_REGION: z.string().optional().default('AE'),
  VAPID_PUBLIC_KEY: z.string().optional().default(''),
  VAPID_PRIVATE_KEY: z.string().optional().default(''),
  VAPID_SUBJECT: z.string().optional().default('mailto:support@localhost'),
})

export type Env = z.infer<typeof EnvSchema>

const DOTENV_PATH = resolve(process.cwd(), '.env')

export function loadDotEnv(): void {
  if (!existsSync(DOTENV_PATH)) return
  const text = readFileSync(DOTENV_PATH, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return EnvSchema.parse(source)
}

export function isYoutubeConfigured(env: Env): boolean {
  return Boolean(env.YOUTUBE_API_KEY && env.YOUTUBE_API_KEY.length >= 10)
}

export function isTmdbConfigured(env: Env): boolean {
  return Boolean(env.TMDB_API_KEY && env.TMDB_API_KEY.length >= 16)
}

export function isJustWatchPartnerConfigured(env: Env): boolean {
  return Boolean(env.JUSTWATCH_PARTNER_TOKEN && env.JUSTWATCH_PARTNER_TOKEN.length >= 16)
}

export const YOUTUBE_API_KEY_RE = /^AIza[0-9A-Za-z_-]{20,}$/
export const TMDB_V3_KEY_RE = /^[a-fA-F0-9]{32}$/
export const TMDB_API_KEY_RE = /^(?:[a-fA-F0-9]{32}|[a-zA-Z0-9._-]{16,64})$/

/** Accept the TMDB v3 API key. If the JWT read-access token is pasted, pull the v3 key from `aud`. */
export function normalizeTmdbApiKey(raw: string): string | null {
  const trimmed = raw.trim().replace(/^["']|["']$/g, '')
  if (!trimmed) return null
  if (TMDB_V3_KEY_RE.test(trimmed)) return trimmed.toLowerCase()
  if (trimmed.startsWith('eyJ')) {
    try {
      const payloadPart = trimmed.split('.')[1]
      if (!payloadPart) return null
      const b64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
      const padded = `${b64}${'='.repeat((4 - (b64.length % 4)) % 4)}`
      const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as { aud?: unknown }
      if (typeof payload.aud === 'string' && TMDB_V3_KEY_RE.test(payload.aud)) {
        return payload.aud.toLowerCase()
      }
    } catch {
      return null
    }
    return null
  }
  if (TMDB_API_KEY_RE.test(trimmed)) return trimmed
  return null
}

export function persistYoutubeApiKey(env: Env, apiKey: string): void {
  env.YOUTUBE_API_KEY = apiKey
  process.env.YOUTUBE_API_KEY = apiKey
  let text = existsSync(DOTENV_PATH) ? readFileSync(DOTENV_PATH, 'utf8') : ''
  if (/^YOUTUBE_API_KEY=/m.test(text)) {
    text = text.replace(/^YOUTUBE_API_KEY=.*$/m, `YOUTUBE_API_KEY=${apiKey}`)
  } else {
    text = `${text.trimEnd()}\nYOUTUBE_API_KEY=${apiKey}\n`
  }
  writeFileSync(DOTENV_PATH, text, 'utf8')
}

export function persistTmdbApiKey(env: Env, apiKey: string): void {
  persistEnvValue(env, 'TMDB_API_KEY', normalizeTmdbApiKey(apiKey) ?? apiKey.trim())
}

type PersistableEnvKey = 'TMDB_API_KEY' | 'VAPID_PUBLIC_KEY' | 'VAPID_PRIVATE_KEY' | 'VAPID_SUBJECT'

export function persistEnvValue(env: Env, key: PersistableEnvKey, value: string): void {
  env[key] = value
  process.env[key] = value
  if (env.NODE_ENV === 'test') return
  let text = existsSync(DOTENV_PATH) ? readFileSync(DOTENV_PATH, 'utf8') : ''
  const line = `${key}=${value}`
  if (new RegExp(`^${key}=`, 'm').test(text)) {
    text = text.replace(new RegExp(`^${key}=.*$`, 'm'), line)
  } else {
    text = `${text.trimEnd()}\n${line}\n`
  }
  writeFileSync(DOTENV_PATH, text, 'utf8')
}

export function logSafe(message: string, extra?: Record<string, string | number | boolean | undefined>): void {
  const payload = { ts: new Date().toISOString(), message, ...extra }
  console.info(JSON.stringify(payload))
}
