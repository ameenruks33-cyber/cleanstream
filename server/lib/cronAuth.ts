import { timingSafeEqual } from 'node:crypto'
import type { Env } from '../config/env.ts'

export function cronAuthorized(req: { header: (name: string) => string | undefined }, env: Env): boolean {
  if (!env.MOVIE_CRON_SECRET) return env.NODE_ENV !== 'production'
  const provided = req.header('x-cron-secret') ?? ''
  const expected = env.MOVIE_CRON_SECRET
  const left = Buffer.from(provided)
  const right = Buffer.from(expected)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}
