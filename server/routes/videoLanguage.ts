import { Router } from 'express'
import { z } from 'zod'
import { validateOwnedVideoId, validateYoutubeVideoId } from '../../src/lib/validation.ts'
import type { VideoLanguageCode } from '../../src/lib/videoLanguages.ts'
import {
  findAuthorizedVideo,
  findTranslatedTrack,
  renderTrackVtt,
} from '../services/videoLanguage/catalog.ts'
import { enqueueTranslationJob, getTranslationJob } from '../services/videoLanguage/jobs.ts'

const JOB_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TRACK_FILE_RE = /^(ml|ta|en|hi|ar)\.vtt$/

const schema = z
  .object({
    videoId: z.string().min(1).max(200),
    language: z.enum(['ml', 'ta', 'en', 'hi', 'ar']),
    mode: z.enum(['subtitles', 'dubbed']),
  })
  .strict()

function isSafeId(id: string): boolean {
  return !id.includes('..') && !id.includes('/') && !id.includes('\\') && !id.includes('\0')
}

export function videoLanguageRouter(): Router {
  const router = Router()

  router.post('/', async (req, res) => {
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid video language settings.', code: 'INVALID_LANGUAGE' })
      return
    }

    const { videoId, language, mode } = parsed.data

    if (validateYoutubeVideoId(videoId).ok) {
      res.status(404).json({
        error: 'YouTube streams cannot be transcribed or dubbed. Open a licensed MyTube library title.',
        code: 'YOUTUBE_NOT_TRANSLATABLE',
      })
      return
    }

    const owned = validateOwnedVideoId(videoId)
    if (!owned.ok) {
      res.status(400).json({ error: owned.error, code: owned.code })
      return
    }

    if (!isSafeId(owned.value)) {
      res.status(404).json({ error: 'Video not found or unavailable for processing.', code: 'NOT_FOUND' })
      return
    }

    const video = findAuthorizedVideo(owned.value)
    if (!video) {
      res.status(404).json({
        error: 'Video not found or unavailable for processing.',
        code: 'NOT_FOUND',
      })
      return
    }

    const existing = findTranslatedTrack(owned.value, language, mode)
    if (existing) {
      res.json({
        status: 'ready',
        videoId: owned.value,
        language,
        mode,
        trackUrl: existing.url,
        audioUrl: existing.audioUrl,
        cues: existing.cues,
      })
      return
    }

    const job = await enqueueTranslationJob({
      videoId: owned.value,
      language,
      mode,
    })

    res.status(202).json({
      status: 'queued',
      jobId: job.jobId,
      videoId: job.videoId,
      language: job.language,
      mode: job.mode,
    })
  })

  router.get('/jobs/:jobId', (req, res) => {
    const jobId = String(req.params.jobId ?? '')
    if (!JOB_ID_RE.test(jobId)) {
      res.status(400).json({ error: 'Invalid job id.', code: 'INVALID_JOB' })
      return
    }
    const job = getTranslationJob(jobId)
    if (!job) {
      res.status(404).json({ error: 'Job not found.', code: 'NOT_FOUND' })
      return
    }
    res.json({
      status: job.status,
      jobId: job.jobId,
      videoId: job.videoId,
      language: job.language,
      mode: job.mode,
      trackUrl: job.trackUrl,
      audioUrl: job.audioUrl,
      cues: job.cues,
      error: job.error,
    })
  })

  router.get('/media/:videoId/:file', (req, res) => {
    const videoIdRaw = String(req.params.videoId ?? '')
    const file = String(req.params.file ?? '')
    const match = file.match(TRACK_FILE_RE)
    const owned = validateOwnedVideoId(videoIdRaw)
    if (!owned.ok || !match || !isSafeId(owned.value)) {
      res.status(404).json({ error: 'Track not found.', code: 'NOT_FOUND' })
      return
    }
    if (!findAuthorizedVideo(owned.value)) {
      res.status(404).json({ error: 'Video not found or unavailable for processing.', code: 'NOT_FOUND' })
      return
    }
    const language = match[1] as VideoLanguageCode
    const vtt = renderTrackVtt(owned.value, language)
    if (!vtt) {
      res.status(404).json({ error: 'Track not found.', code: 'NOT_FOUND' })
      return
    }
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.send(vtt)
  })

  return router
}
