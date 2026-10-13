import type { VideoRef } from '@/types'
import { validateOwnedVideoId, validateVideoSource, validateYoutubeVideoId } from '@/lib/validation'

export const WATCH_QUEUE_KEY = 'cleanstream.watch-queue.v1'
const MAX_ITEMS = 40

export type WatchQueueItem = Pick<VideoRef, 'id' | 'source' | 'title' | 'channelTitle' | 'thumbnailUrl'>

export type WatchQueue = {
  items: WatchQueueItem[]
  origin: string
}

export function videoKey(video: Pick<VideoRef, 'source' | 'id'>): string {
  return `${video.source}:${video.id}`
}

export function watchPath(video: Pick<VideoRef, 'source' | 'id'>): string {
  return `/watch/${video.source}/${encodeURIComponent(video.id)}`
}

export function safeWatchOrigin(raw: unknown): string {
  if (typeof raw !== 'string') return '/'
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/'
  if (raw.includes('://')) return '/'
  return raw.slice(0, 500)
}

function slim(video: VideoRef): WatchQueueItem {
  return {
    id: video.id,
    source: video.source,
    title: video.title,
    channelTitle: video.channelTitle,
    thumbnailUrl: video.thumbnailUrl,
  }
}

function isQueueItem(value: unknown): value is WatchQueueItem {
  if (!value || typeof value !== 'object') return false
  const item = value as WatchQueueItem
  const source = validateVideoSource(String(item.source ?? ''))
  if (!source.ok) return false
  const id = source.value === 'youtube' ? validateYoutubeVideoId(String(item.id ?? '')) : validateOwnedVideoId(String(item.id ?? ''))
  if (!id.ok) return false
  return typeof item.title === 'string' && typeof item.channelTitle === 'string' && typeof item.thumbnailUrl === 'string'
}

export function uniqueQueueItems(items: WatchQueueItem[]): WatchQueueItem[] {
  const seen = new Set<string>()
  const unique: WatchQueueItem[] = []
  for (const item of items) {
    const key = videoKey(item)
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(item)
    if (unique.length >= MAX_ITEMS) break
  }
  return unique
}

export function emptyWatchQueue(): WatchQueue {
  return { items: [], origin: '/' }
}

export function writeWatchQueue(queue: WatchQueue): void {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(
    WATCH_QUEUE_KEY,
    JSON.stringify({ items: uniqueQueueItems(queue.items), origin: safeWatchOrigin(queue.origin) }),
  )
}

export function rememberWatchQueue(items: VideoRef[], origin = '/'): void {
  writeWatchQueue({ items: items.map(slim), origin: safeWatchOrigin(origin) })
}

export function readWatchQueue(): WatchQueue {
  if (typeof sessionStorage === 'undefined') return emptyWatchQueue()
  try {
    const raw = sessionStorage.getItem(WATCH_QUEUE_KEY)
    if (!raw) return emptyWatchQueue()
    const parsed = JSON.parse(raw) as { items?: unknown; origin?: unknown }
    const items = Array.isArray(parsed.items) ? parsed.items.filter(isQueueItem) : []
    return { items: uniqueQueueItems(items), origin: safeWatchOrigin(parsed.origin) }
  } catch {
    return emptyWatchQueue()
  }
}

export function neighborsInQueue(
  items: WatchQueueItem[],
  source: string,
  id: string,
): { index: number; previous: WatchQueueItem | null; next: WatchQueueItem | null } {
  const index = items.findIndex((item) => item.source === source && item.id === id)
  if (index < 0) return { index: -1, previous: null, next: null }
  return {
    index,
    previous: items[index - 1] ?? null,
    next: items[index + 1] ?? null,
  }
}

export function ensureCurrentInQueue(video: VideoRef, extras: VideoRef[]): WatchQueue {
  const stored = readWatchQueue()
  const already = stored.items.some((item) => item.source === video.source && item.id === video.id)
  if (already) return stored
  const queue: WatchQueue = {
    items: uniqueQueueItems([slim(video), ...stored.items, ...extras.map(slim)]),
    origin: stored.origin || '/',
  }
  writeWatchQueue(queue)
  return queue
}
