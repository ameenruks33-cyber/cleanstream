import { randomUUID } from 'node:crypto'
import { basename } from 'node:path'
import { existsSync } from 'node:fs'
import { Router, type Response } from 'express'
import { z } from 'zod'
import { validateOwnedVideoId, validateYoutubeVideoId } from '../../src/lib/validation.ts'
import {
  getJob,
  inspectQuality,
  queueEnhance,
  saveUpload,
  youtubeQualityNotice,
} from '../services/enhance/engine.ts'
import { FILE_ID_RE, INPUT_DIR, OUTPUT_DIR, OUTPUT_ID_RE, ensureMediaDirs, isInsideDir, safeMediaFile } from '../services/enhance/paths.ts'
import { resolveAuthorizedSource } from '../services/enhance/sources.ts'

const EnhanceBody = z.object({ fileId: z.string() }).strict()
const MAX_UPLOAD_BYTES = 80 * 1024 * 1024

function isLoopback(ip: string | undefined): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'
}

function isSafeMediaId(id: string): boolean {
  return !id.includes('..') && !id.includes('/') && !id.includes('\\') && !id.includes('\0')
}

function sendAuthorizedMp4(res: Response, dir: string, id: string): boolean {
  if (!isSafeMediaId(id)) return false
  const file = safeMediaFile(dir, id, '.mp4')
  if (!isInsideDir(dir, file) || !existsSync(file)) return false
  const name = basename(file)
  if (name !== `${id}.mp4` || name.includes('..') || name.includes('/') || name.includes('\\')) {
    return false
  }
  res.type('video/mp4')
  res.sendFile(name, { root: dir, dotfiles: 'deny' })
  return true
}

export function enhanceRouter(): Router {
  const router = Router()
  ensureMediaDirs()

  router.get('/quality', async (req, res) => {
    const source = String(req.query.source ?? '')
    const id = String(req.query.id ?? '')
    if (source === 'youtube') {
      const parsed = validateYoutubeVideoId(id)
      if (!parsed.ok) {
        res.status(400).json({ error: parsed.error, code: parsed.code })
        return
      }
      res.json(youtubeQualityNotice(parsed.value))
      return
    }
    const parsed = validateOwnedVideoId(id)
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error, code: parsed.code })
      return
    }
    try {
      const report = await inspectQuality(parsed.value)
      res.json(report)
    } catch {
      res.status(502).json({ error: 'Could not analyze this file.', code: 'PROBE_FAILED' })
    }
  })

  router.post('/', (req, res) => {
    const parsed = EnhanceBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Provide a MyTube fileId.', code: 'INVALID_VIDEO_ID' })
      return
    }
    const fileId = parsed.data.fileId
    if (validateYoutubeVideoId(fileId).ok && !resolveAuthorizedSource(fileId)) {
      res.status(400).json({
        error: 'YouTube streams cannot be extracted or upscaled.',
        code: 'YOUTUBE_NOT_ENHANCEABLE',
      })
      return
    }
    const owned = validateOwnedVideoId(fileId)
    if (!owned.ok) {
      res.status(400).json({ error: owned.error, code: owned.code })
      return
    }
    try {
      const job = queueEnhance(owned.value)
      res.status(202).json(job)
    } catch (error) {
      const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500
      const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : 'ENHANCE_FAILED'
      const message = error instanceof Error ? error.message : 'Could not queue enhancement.'
      res.status(status || 500).json({ error: message, code })
    }
  })

  router.get('/jobs/:jobId', (req, res) => {
    const jobId = String(req.params.jobId ?? '')
    if (!OUTPUT_ID_RE.test(jobId)) {
      res.status(400).json({ error: 'Invalid job id.', code: 'INVALID_JOB' })
      return
    }
    const job = getJob(jobId)
    if (!job) {
      res.status(404).json({ error: 'Job not found.', code: 'NOT_FOUND' })
      return
    }
    res.json(job)
  })

  router.get('/source/:fileId', (req, res) => {
    const fileId = String(req.params.fileId ?? '')
    if (!FILE_ID_RE.test(fileId) || !resolveAuthorizedSource(fileId)) {
      res.status(404).json({ error: 'Source file not found.', code: 'NOT_FOUND' })
      return
    }
    try {
      if (!isSafeMediaId(fileId) || !sendAuthorizedMp4(res, INPUT_DIR, fileId)) {
        res.status(404).json({ error: 'Source file not found.', code: 'NOT_FOUND' })
      }
    } catch {
      res.status(404).json({ error: 'Source file not found.', code: 'NOT_FOUND' })
    }
  })

  router.get('/media/:outputId', (req, res) => {
    const outputId = String(req.params.outputId ?? '')
    if (!OUTPUT_ID_RE.test(outputId)) {
      res.status(400).json({ error: 'Invalid output id.', code: 'INVALID_MEDIA' })
      return
    }
    try {
      if (!isSafeMediaId(outputId) || !sendAuthorizedMp4(res, OUTPUT_DIR, outputId)) {
        res.status(404).json({ error: 'Enhanced file not found.', code: 'NOT_FOUND' })
      }
    } catch {
      res.status(404).json({ error: 'Enhanced file not found.', code: 'NOT_FOUND' })
    }
  })

  router.post('/upload', (req, res) => {
    if (!isLoopback(req.ip)) {
      res.status(403).json({ error: 'Uploads are local-only.', code: 'FORBIDDEN' })
      return
    }
    const type = String(req.headers['content-type'] ?? '')
    if (type !== 'video/mp4' && type !== 'application/octet-stream') {
      res.status(415).json({ error: 'Upload an MP4 file.', code: 'UNSUPPORTED_TYPE' })
      return
    }
    const fileId = `upload-${randomUUID()}`
    void saveUpload(fileId, req, MAX_UPLOAD_BYTES)
      .then(() => {
        const job = queueEnhance(fileId)
        res.status(202).json({ fileId, job })
      })
      .catch((error: unknown) => {
        const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 400
        const message = error instanceof Error ? error.message : 'Upload failed.'
        res.status(status || 400).json({ error: message, code: 'UPLOAD_FAILED' })
      })
  })

  return router
}
