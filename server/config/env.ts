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

export const YOUTUBE_API_KEY_RE = /^AIza[0-9A-Za-z_-]{20,}$/

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

export function logSafe(message: string, extra?: Record<string, string | number | boolean | undefined>): void {
  const payload = { ts: new Date().toISOString(), message, ...extra }
  console.info(JSON.stringify(payload))
}
