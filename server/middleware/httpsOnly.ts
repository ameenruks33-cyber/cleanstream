import type { NextFunction, Request, Response } from 'express'
import type { Env } from '../config/env.ts'
import { isAllowedOrigin } from './security.ts'

export function httpsOnly(env: Env) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (env.NODE_ENV !== 'production') {
      next()
      return
    }
    const proto = String(req.header('x-forwarded-proto') ?? '').split(',')[0]?.trim()
    if (proto && proto !== 'https') {
      const host = req.header('host') ?? ''
      if (!host || host.includes('/') || host.includes('@') || host.includes('\\')) {
        res.status(400).json({ error: 'HTTPS is required.', code: 'HTTPS_ONLY' })
        return
      }
      const target = `https://${host}`
      if (!isAllowedOrigin(target, env)) {
        res.status(400).json({ error: 'HTTPS is required.', code: 'HTTPS_ONLY' })
        return
      }
      res.redirect(301, `${target}${req.originalUrl}`)
      return
    }
    next()
  }
}
