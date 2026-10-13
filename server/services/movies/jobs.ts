import { logSafe, type Env } from '../../config/env.ts'
import { getMovieEngine } from './engine.ts'

type RefreshJob = {
  id: string
  movieId: string
  country: string
  attempts: number
  runAt: number
}

const MAX_ATTEMPTS = 4
const MAX_QUEUE = 40
const CONCURRENCY = 1

const queue: RefreshJob[] = []
const inflight = new Set<string>()
let running = 0
let loop: ReturnType<typeof setInterval> | undefined
let lastError: string | undefined
let lastRunAt: string | undefined
let refreshed = 0
let failed = 0

function jobKey(movieId: string, country: string): string {
  return `${movieId}:${country}`
}

function backoffMs(attempts: number): number {
  return Math.min(30_000, 400 * 2 ** attempts)
}

export function enqueueMovieRefresh(movieId: string, country: string): boolean {
  const id = jobKey(movieId, country)
  if (inflight.has(id) || queue.some((job) => job.id === id)) return false
  if (queue.length >= MAX_QUEUE) return false
  queue.push({ id, movieId, country, attempts: 0, runAt: Date.now() })
  return true
}

async function runNext(env: Env): Promise<void> {
  if (running >= CONCURRENCY) return
  const now = Date.now()
  const index = queue.findIndex((job) => job.runAt <= now)
  if (index === -1) return
  const job = queue.splice(index, 1)[0]
  if (!job) return
  running += 1
  inflight.add(job.id)
  try {
    await getMovieEngine(env).getMovie(job.movieId, job.country)
    refreshed += 1
    lastRunAt = new Date().toISOString()
    lastError = undefined
  } catch (error) {
    job.attempts += 1
    failed += 1
    lastError = error instanceof Error ? error.message : 'refresh failed'
    if (job.attempts < MAX_ATTEMPTS) {
      job.runAt = Date.now() + backoffMs(job.attempts)
      queue.push(job)
    }
    logSafe('movie_refresh_failed', { movieId: job.movieId, country: job.country, attempts: job.attempts })
  } finally {
    inflight.delete(job.id)
    running -= 1
  }
}

export function startMovieRefreshLoop(env: Env): void {
  if (loop) return
  loop = setInterval(() => {
    void runNext(env)
  }, 1500)
  loop.unref?.()
}

export function stopMovieRefreshLoop(): void {
  if (loop) clearInterval(loop)
  loop = undefined
  queue.length = 0
  inflight.clear()
}

export function movieJobStatus() {
  return {
    queued: queue.length,
    running,
    refreshed,
    failed,
    lastRunAt,
    lastError,
  }
}
