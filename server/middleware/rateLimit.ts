import rateLimit from 'express-rate-limit'
import type { Env } from '../config/env.ts'

export function createApiLimiter(env: Env) {
  const max = env.RATE_LIMIT_MAX ?? (env.NODE_ENV === 'test' ? 5 : 45)
  return rateLimit({
    windowMs: 60 * 1000,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many requests. Slow down and try again in a minute.',
      code: 'RATE_LIMITED',
    },
  })
}
