import { YOUTUBE_ID_RE } from '../../src/lib/validation.ts'
import type { YoutubeSearchResponse, YoutubeVideo } from '../../src/types/index.ts'

const FETCH_TIMEOUT_MS = 7000
const CACHE_TTL_MS = 10 * 60 * 1000
const MAX_RESULTS = 24

type CatalogKind = 'invidious' | 'piped'

type CatalogEndpoint = {
  kind: CatalogKind
  origin: string
  path: string
}

/** Fixed HTTPS origins only — never built from user input. */
const CATALOG_ENDPOINTS: CatalogEndpoint[] = [
  { kind: 'invidious', origin: 'https://invidious.f5.si', path: '/api/v1/search' },
  { kind: 'piped', origin: 'https://api.piped.private.coffee', path: '/search' },
]

type CacheEntry = { expires: number; value: YoutubeSearchResponse }
const cache = new Map<string, CacheEntry>()

type InvidiousItem = {
  type?: string
  title?: string
  videoId?: string
  author?: string
  authorId?: string
  published?: number
  lengthSeconds?: number
  viewCount?: number
}

type PipedItem = {
  type?: string
  title?: string
  url?: string
  uploaderName?: string
  uploaderUrl?: string
  uploaded?: number
  duration?: number
  views?: number
}

function officialThumb(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
}

function clockFromSeconds(total?: number): string | undefined {
  if (typeof total !== 'number' || !Number.isFinite(total) || total < 0) return undefined
  const seconds = Math.floor(total)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
  }
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

function toIso(value?: number): string | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined
  const ms = value > 1e12 ? value : value * 1000
  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString()
}

function videoFromFields(fields: {
  id: string
  title?: string
  channelTitle?: string
  channelId?: string
  publishedAt?: string
  duration?: string
  viewCount?: string
}): YoutubeVideo | null {
  if (!YOUTUBE_ID_RE.test(fields.id)) return null
  return {
    id: fields.id,
    source: 'youtube',
    title: fields.title?.trim() || 'YouTube video',
    channelTitle: fields.channelTitle?.trim() || 'YouTube',
    channelId: fields.channelId,
    thumbnailUrl: officialThumb(fields.id),
    publishedAt: fields.publishedAt,
    duration: fields.duration,
    viewCount: fields.viewCount,
    embeddable: true,
  }
}

function mapInvidious(items: InvidiousItem[]): YoutubeVideo[] {
  const videos: YoutubeVideo[] = []
  for (const item of items) {
    if (item.type && item.type !== 'video') continue
    const mapped = videoFromFields({
      id: item.videoId ?? '',
      title: item.title,
      channelTitle: item.author,
      channelId: item.authorId,
      publishedAt: toIso(item.published),
      duration: clockFromSeconds(item.lengthSeconds),
      viewCount: typeof item.viewCount === 'number' ? String(item.viewCount) : undefined,
    })
    if (mapped) videos.push(mapped)
    if (videos.length >= MAX_RESULTS) break
  }
  return videos
}

function pipedVideoId(url?: string): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url, 'https://www.youtube.com')
    const id = parsed.searchParams.get('v')
    return id && YOUTUBE_ID_RE.test(id) ? id : null
  } catch {
    return null
  }
}

function pipedChannelId(url?: string): string | undefined {
  if (!url) return undefined
  const match = url.match(/\/channel\/([A-Za-z0-9_-]+)/)
  return match?.[1]
}

function mapPiped(items: PipedItem[]): YoutubeVideo[] {
  const videos: YoutubeVideo[] = []
  for (const item of items) {
    if (item.type && item.type !== 'stream') continue
    const id = pipedVideoId(item.url)
    if (!id) continue
    const mapped = videoFromFields({
      id,
      title: item.title,
      channelTitle: item.uploaderName,
      channelId: pipedChannelId(item.uploaderUrl),
      publishedAt: toIso(item.uploaded),
      duration: clockFromSeconds(item.duration),
      viewCount: typeof item.views === 'number' ? String(item.views) : undefined,
    })
    if (mapped) videos.push(mapped)
    if (videos.length >= MAX_RESULTS) break
  }
  return videos
}

function catalogUrl(endpoint: CatalogEndpoint, query: string, page: number): URL {
  const url = new URL(endpoint.path, endpoint.origin)
  url.searchParams.set('q', query)
  if (endpoint.kind === 'invidious') {
    url.searchParams.set('type', 'video')
    url.searchParams.set('page', String(page))
  } else {
    url.searchParams.set('filter', 'videos')
  }
  return url
}

function parsePage(pageToken?: string): number {
  const parsed = Number.parseInt(pageToken ?? '1', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

async function fetchJson(url: URL): Promise<unknown | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'CleanStream/1.0',
      },
      signal: controller.signal,
    })
    if (!response.ok) return null
    const text = await response.text()
    if (!text.trim().startsWith('[') && !text.trim().startsWith('{')) return null
    return JSON.parse(text) as unknown
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function itemsFromPayload(kind: CatalogKind, payload: unknown): YoutubeVideo[] {
  if (kind === 'invidious' && Array.isArray(payload)) {
    return mapInvidious(payload as InvidiousItem[])
  }
  if (kind === 'piped' && payload && typeof payload === 'object' && 'items' in payload) {
    const items = (payload as { items?: PipedItem[] }).items
    if (Array.isArray(items)) return mapPiped(items)
  }
  return []
}

export async function searchPublicCatalog(
  query: string,
  pageToken?: string,
): Promise<YoutubeSearchResponse | null> {
  const page = parsePage(pageToken)
  const cacheKey = `catalog:${query}:${page}`
  const hit = cache.get(cacheKey)
  if (hit && hit.expires > Date.now()) return hit.value

  for (const endpoint of CATALOG_ENDPOINTS) {
    const payload = await fetchJson(catalogUrl(endpoint, query, page))
    if (payload == null) continue
    const items = itemsFromPayload(endpoint.kind, payload)
    if (items.length === 0) continue
    const result: YoutubeSearchResponse = {
      items,
      nextPageToken: endpoint.kind === 'invidious' && items.length >= MAX_RESULTS ? String(page + 1) : undefined,
      totalResults: items.length,
    }
    cache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, value: result })
    return result
  }
  return null
}

export function clearPublicCatalogCache(): void {
  cache.clear()
}
