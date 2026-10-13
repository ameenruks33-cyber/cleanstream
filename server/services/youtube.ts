import { mockSearch, mockYoutubeVideos } from '../../src/data/mockYoutube.ts'
import { extractYoutubeVideoId } from '../../src/lib/youtube.ts'
import type { YoutubeSearchResponse, YoutubeVideo } from '../../src/types/index.ts'
import { isYoutubeConfigured, type Env } from '../config/env.ts'
import { clearPublicCatalogCache, searchPublicCatalog } from './publicCatalog.ts'

const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3'
const FETCH_TIMEOUT_MS = 8000
const CACHE_TTL_MS = 10 * 60 * 1000

type CacheEntry = { expires: number; value: unknown }
const cache = new Map<string, CacheEntry>()
const videoMemory = new Map<string, YoutubeVideo>()
const embedAllowedCache = new Map<string, { expires: number; allowed: boolean }>()

function rememberYoutubeVideos(videos: YoutubeVideo[]): void {
  for (const video of videos) {
    videoMemory.set(video.id, video)
  }
}

type YoutubeErrorPayload = {
  error?: {
    message?: string
    errors?: Array<{ reason?: string; message?: string }>
  }
}

export class YoutubeServiceError extends Error {
  status: number
  code: string
  constructor(message: string, status = 502, code = 'YOUTUBE_ERROR') {
    super(message)
    this.name = 'YoutubeServiceError'
    this.status = status
    this.code = code
  }
}

export function parseYoutubeError(status: number, payload: YoutubeErrorPayload | null): YoutubeServiceError {
  const reason = payload?.error?.errors?.[0]?.reason ?? ''
  const message = payload?.error?.message ?? 'YouTube API request failed.'
  if (status === 403 && /quota/i.test(`${reason} ${message}`)) {
    return new YoutubeServiceError(
      'YouTube API quota is exhausted for now. Try again later, or browse MyTube library videos.',
      429,
      'QUOTA_EXCEEDED',
    )
  }
  if (status === 403) {
    return new YoutubeServiceError(
      'YouTube API rejected this request. Check API key restrictions in Google Cloud.',
      403,
      'FORBIDDEN',
    )
  }
  if (status === 400) {
    return new YoutubeServiceError('YouTube API could not process that query.', 400, 'BAD_REQUEST')
  }
  return new YoutubeServiceError(message, status >= 400 ? status : 502, 'YOUTUBE_ERROR')
}

function isoDurationToClock(iso?: string): string | undefined {
  return iso
}

function mapThumbnail(snippet: {
  thumbnails?: Record<string, { url?: string }>
}): string {
  return (
    snippet.thumbnails?.high?.url ||
    snippet.thumbnails?.medium?.url ||
    snippet.thumbnails?.default?.url ||
    ''
  )
}

export function mapVideoResource(item: {
  id?: string | { videoId?: string }
  snippet?: {
    title?: string
    channelTitle?: string
    channelId?: string
    description?: string
    publishedAt?: string
    thumbnails?: Record<string, { url?: string }>
  }
  contentDetails?: { duration?: string }
  statistics?: { viewCount?: string }
  status?: { embeddable?: boolean }
}): YoutubeVideo | null {
  const id = typeof item.id === 'string' ? item.id : item.id?.videoId
  if (!id || !item.snippet) return null
  return {
    id,
    source: 'youtube',
    title: item.snippet.title ?? 'Untitled',
    channelTitle: item.snippet.channelTitle ?? 'YouTube',
    channelId: item.snippet.channelId,
    thumbnailUrl: mapThumbnail(item.snippet),
    publishedAt: item.snippet.publishedAt,
    duration: isoDurationToClock(item.contentDetails?.duration),
    viewCount: item.statistics?.viewCount,
    description: item.snippet.description,
    embeddable: item.status?.embeddable !== false,
  }
}

async function youtubeFetch(env: Env, path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`${YOUTUBE_API}${path}`)
  url.searchParams.set('key', env.YOUTUBE_API_KEY)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  const cacheKey = url.toString().replace(env.YOUTUBE_API_KEY, 'REDACTED')
  const hit = cache.get(cacheKey)
  if (hit && hit.expires > Date.now()) {
    return hit.value
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    const json = (await response.json()) as YoutubeErrorPayload
    if (!response.ok) {
      throw parseYoutubeError(response.status, json)
    }
    cache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, value: json })
    return json
  } catch (error) {
    if (error instanceof YoutubeServiceError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new YoutubeServiceError('YouTube API timed out.', 504, 'TIMEOUT')
    }
    throw new YoutubeServiceError('Could not reach YouTube API.', 503, 'NETWORK')
  } finally {
    clearTimeout(timer)
  }
}

async function hydrateVideoIds(env: Env, ids: string[]): Promise<YoutubeVideo[]> {
  if (ids.length === 0) return []
  const json = (await youtubeFetch(env, '/videos', {
    part: 'snippet,contentDetails,statistics,status',
    id: ids.join(','),
  })) as { items?: Array<Parameters<typeof mapVideoResource>[0]> }
  return (json.items ?? []).map(mapVideoResource).filter((item): item is YoutubeVideo => Boolean(item))
}

function stubVideo(id: string, extras: Partial<YoutubeVideo> = {}): YoutubeVideo {
  return {
    id,
    source: 'youtube',
    title: extras.title ?? 'YouTube video',
    channelTitle: extras.channelTitle ?? 'YouTube',
    thumbnailUrl: extras.thumbnailUrl ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    publishedAt: extras.publishedAt,
    duration: extras.duration,
    viewCount: extras.viewCount,
    description: extras.description,
    embeddable: extras.embeddable ?? true,
    channelId: extras.channelId,
  }
}

function oEmbedUrl(id: string): URL {
  const url = new URL('https://www.youtube.com/oembed')
  url.searchParams.set('url', `https://www.youtube.com/watch?v=${id}`)
  url.searchParams.set('format', 'json')
  return url
}

async function fetchOEmbedResponse(id: string): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(oEmbedUrl(id), {
      signal: controller.signal,
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'MyTube/1.0',
      },
    })
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function oEmbedAllowsEmbed(id: string): Promise<boolean | null> {
  const hit = embedAllowedCache.get(id)
  if (hit && hit.expires > Date.now()) return hit.allowed
  const response = await fetchOEmbedResponse(id)
  if (!response) return null
  if (response.status === 401 || response.status === 403) {
    embedAllowedCache.set(id, { expires: Date.now() + CACHE_TTL_MS, allowed: false })
    return false
  }
  if (!response.ok) return null
  embedAllowedCache.set(id, { expires: Date.now() + CACHE_TTL_MS, allowed: true })
  return true
}

async function preferEmbeddable(videos: YoutubeVideo[]): Promise<YoutubeVideo[]> {
  if (videos.length === 0) return videos
  const checked = await Promise.all(
    videos.map(async (video) => {
      if (video.embeddable === false) return null
      const allowed = await oEmbedAllowsEmbed(video.id)
      if (allowed === false) return null
      return video
    }),
  )
  const playable = checked.filter((video): video is YoutubeVideo => Boolean(video))
  return playable.length > 0 ? playable : videos
}

async function fetchOEmbed(id: string): Promise<YoutubeVideo> {
  const remembered = videoMemory.get(id)
  const response = await fetchOEmbedResponse(id)
  if (!response) {
    return remembered ?? stubVideo(id)
  }
  if (response.status === 401 || response.status === 403) {
    embedAllowedCache.set(id, { expires: Date.now() + CACHE_TTL_MS, allowed: false })
    return remembered ?? stubVideo(id)
  }
  if (!response.ok) {
    return remembered ?? stubVideo(id)
  }
  embedAllowedCache.set(id, { expires: Date.now() + CACHE_TTL_MS, allowed: true })
  try {
    const json = (await response.json()) as {
      title?: string
      author_name?: string
      thumbnail_url?: string
    }
    const video = stubVideo(id, {
      title: json.title ?? remembered?.title,
      channelTitle: json.author_name ?? remembered?.channelTitle,
      thumbnailUrl: json.thumbnail_url ?? remembered?.thumbnailUrl,
      publishedAt: remembered?.publishedAt,
      duration: remembered?.duration,
      viewCount: remembered?.viewCount,
      description: remembered?.description,
      channelId: remembered?.channelId,
      embeddable: true,
    })
    videoMemory.set(id, video)
    return video
  } catch {
    return remembered ?? stubVideo(id)
  }
}

export async function searchYoutube(
  env: Env,
  query: string,
  pageToken?: string,
  type: 'video' | 'channel' | 'all' = 'video',
): Promise<YoutubeSearchResponse> {
  const directId = extractYoutubeVideoId(query)
  if (directId && type !== 'channel') {
    const video = await getYoutubeVideo(env, directId)
    return { items: video ? [video] : [] }
  }

  if (!isYoutubeConfigured(env)) {
    if (type === 'channel') {
      return { items: [] }
    }
    const live = await searchPublicCatalog(query, pageToken)
    if (live?.items.length) {
      const items = await preferEmbeddable(live.items)
      rememberYoutubeVideos(items)
      return { ...live, items }
    }
    return {
      items: mockSearch(query),
      mock: true,
      quotaNotice:
        'Live catalog search is temporarily unavailable. Sample matches are shown when they exist; you can still paste any youtube.com or youtu.be link to watch it.',
    }
  }

  const params: Record<string, string> = {
    part: 'snippet',
    q: query,
    maxResults: '24',
    type: type === 'all' ? 'video,channel' : type,
    safeSearch: 'moderate',
  }
  if (pageToken) params.pageToken = pageToken

  const json = (await youtubeFetch(env, '/search', params)) as {
    nextPageToken?: string
    pageInfo?: { totalResults?: number }
    items?: Array<{
      id?: { videoId?: string; channelId?: string; kind?: string }
      snippet?: Parameters<typeof mapVideoResource>[0]['snippet']
    }>
  }

  const videoIds = (json.items ?? [])
    .map((item) => item.id?.videoId)
    .filter((id): id is string => Boolean(id))

  const videos = await preferEmbeddable(await hydrateVideoIds(env, videoIds))
  rememberYoutubeVideos(videos)

  return {
    items: videos,
    nextPageToken: json.nextPageToken,
    totalResults: json.pageInfo?.totalResults,
  }
}

export async function getYoutubeVideo(env: Env, id: string): Promise<YoutubeVideo | null> {
  const fromMock = mockYoutubeVideos.find((video) => video.id === id)
  if (isYoutubeConfigured(env)) {
    try {
      const [video] = await hydrateVideoIds(env, [id])
      if (video) return video
    } catch {
      if (fromMock) return fromMock
      return fetchOEmbed(id)
    }
  }
  if (fromMock) return fromMock
  return fetchOEmbed(id)
}

export function clearYoutubeCache(): void {
  cache.clear()
  videoMemory.clear()
  embedAllowedCache.clear()
  clearPublicCatalogCache()
}
