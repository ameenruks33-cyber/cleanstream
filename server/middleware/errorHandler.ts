import type { NextFunction, Request, Response } from 'express'
import { YoutubeServiceError } from '../services/youtube.ts'
import { logSafe } from '../config/env.ts'

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found.', code: 'NOT_FOUND' })
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  void _next
  if (error instanceof YoutubeServiceError) {
    logSafe('youtube_service_error', { code: error.code, status: error.status, path: req.path })
    res.status(error.status).json({ error: error.message, code: error.code })
    return
  }
  logSafe('unhandled_error', { path: req.path })
  res.status(500).json({ error: 'Something went wrong.', code: 'INTERNAL' })
}
