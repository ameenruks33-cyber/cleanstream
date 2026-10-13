import { randomUUID } from 'node:crypto'
import type { LanguageCue, VideoLanguageCode, VideoLanguageMode } from '../../../src/lib/videoLanguages.ts'
import { findTranslatedTrack } from './catalog.ts'

export type TranslationJob = {
  jobId: string
  videoId: string
  language: VideoLanguageCode
  mode: VideoLanguageMode
  status: 'queued' | 'ready' | 'failed'
  trackUrl?: string
  audioUrl?: string
  cues?: LanguageCue[]
  error?: string
  createdAt: string
}

const jobs = new Map<string, TranslationJob>()

export function resetVideoLanguageJobs(): void {
  jobs.clear()
}

export function getTranslationJob(jobId: string): TranslationJob | undefined {
  return jobs.get(jobId)
}

export async function enqueueTranslationJob(input: {
  videoId: string
  language: VideoLanguageCode
  mode: VideoLanguageMode
}): Promise<TranslationJob> {
  const jobId = randomUUID()
  const job: TranslationJob = {
    jobId,
    videoId: input.videoId,
    language: input.language,
    mode: input.mode,
    status: 'queued',
    createdAt: new Date().toISOString(),
  }
  jobs.set(jobId, job)
  queueMicrotask(() => {
    const track = findTranslatedTrack(input.videoId, input.language, input.mode)
    const current = jobs.get(jobId)
    if (!current) return
    if (!track) {
      jobs.set(jobId, {
        ...current,
        status: 'failed',
        error: 'No authorized transcript is available for this title.',
      })
      return
    }
    jobs.set(jobId, {
      ...current,
      status: 'ready',
      trackUrl: track.url,
      audioUrl: track.audioUrl,
      cues: track.cues,
    })
  })
  return job
}
