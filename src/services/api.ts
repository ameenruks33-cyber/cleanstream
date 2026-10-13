import type { VideoLanguageCode, VideoLanguageMode, VideoLanguageTrack } from '@/lib/videoLanguages'
import type { ApiErrorBody, EnhanceJob, OwnedVideo, QualityInspection, YoutubeSearchResponse, YoutubeVideo } from '@/types'
import type { MovieDetails, MovieNotification, MovieSearchResponse, WatchRegion } from '@/types/movies'

async function readError(response: Response): Promise<ApiErrorBody> {
  try {
    return (await response.json()) as ApiErrorBody
  } catch {
    return { error: 'Unexpected server response.', code: 'INVALID_RESPONSE' }
  }
}

export async function fetchHealth(): Promise<{
  ok: boolean
  youtubeConfigured: boolean
  moviesConfigured: boolean
  tmdbConfigured: boolean
  supabaseConfigured: boolean
  pushConfigured?: boolean
}> {
  const response = await fetch('/api/health')
  if (!response.ok) {
    return { ok: false, youtubeConfigured: false, moviesConfigured: false, tmdbConfigured: false, supabaseConfigured: false }
  }
  return response.json() as Promise<{
    ok: boolean
    youtubeConfigured: boolean
    moviesConfigured: boolean
    tmdbConfigured: boolean
    supabaseConfigured: boolean
    pushConfigured?: boolean
  }>
}

export async function fetchWatchRegions(): Promise<{ defaultCountry: string; regions: WatchRegion[]; note: string }> {
  const response = await fetch('/api/movies/regions')
  if (!response.ok) {
    const body = await readError(response)
    throw Object.assign(new Error(body.error), { code: body.code })
  }
  return response.json() as Promise<{ defaultCountry: string; regions: WatchRegion[]; note: string }>
}

export async function searchMovies(input: {
  query: string
  country?: string
  year?: string
  language?: string
  originalLanguage?: string
  page?: number
}): Promise<MovieSearchResponse> {
  const params = new URLSearchParams({ q: input.query })
  if (input.country) params.set('country', input.country)
  if (input.year) params.set('year', input.year)
  if (input.language) params.set('language', input.language)
  if (input.originalLanguage) params.set('originalLanguage', input.originalLanguage)
  if (input.page) params.set('page', String(input.page))
  const response = await fetch(`/api/movies/search?${params}`)
  if (!response.ok) {
    const body = await readError(response)
    throw Object.assign(new Error(body.error), { code: body.code })
  }
  return response.json() as Promise<MovieSearchResponse>
}

export async function fetchMovie(id: string, country?: string, language?: string): Promise<MovieDetails> {
  const params = new URLSearchParams()
  if (country) params.set('country', country)
  if (language) params.set('language', language)
  const query = params.toString()
  const response = await fetch(`/api/movies/${encodeURIComponent(id)}${query ? `?${query}` : ''}`)
  if (!response.ok) {
    const body = await readError(response)
    throw Object.assign(new Error(body.error), { code: body.code })
  }
  const json = (await response.json()) as { movie: MovieDetails }
  return json.movie
}

export async function refreshMovieWatchlist(input: {
  ids: string[]
  country?: string
  previous?: Record<string, string>
}): Promise<{
  items: MovieDetails[]
  notifications: MovieNotification[]
  fingerprints: Record<string, string>
}> {
  const response = await fetch('/api/movies/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const body = await readError(response)
    throw Object.assign(new Error(body.error), { code: body.code })
  }
  return response.json() as Promise<{
    items: MovieDetails[]
    notifications: MovieNotification[]
    fingerprints: Record<string, string>
  }>
}

export async function searchYoutube(query: string, pageToken?: string): Promise<YoutubeSearchResponse> {
  const params = new URLSearchParams({ q: query })
  if (pageToken) params.set('pageToken', pageToken)
  const response = await fetch(`/api/youtube/search?${params}`)
  if (!response.ok) {
    const body = await readError(response)
    throw Object.assign(new Error(body.error), { code: body.code })
  }
  return response.json() as Promise<YoutubeSearchResponse>
}

export async function saveTmdbApiKey(apiKey: string): Promise<void> {
  const response = await fetch('/api/setup/tmdb-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  })
  if (!response.ok) {
    const body = await readError(response)
    throw Object.assign(new Error(body.error), { code: body.code })
  }
}

export async function saveYoutubeApiKey(apiKey: string): Promise<void> {
  const response = await fetch('/api/setup/youtube-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  })
  if (!response.ok) {
    const body = await readError(response)
    throw Object.assign(new Error(body.error), { code: body.code })
  }
}

export async function fetchYoutubeVideo(id: string): Promise<YoutubeVideo> {
  const response = await fetch(`/api/youtube/videos/${encodeURIComponent(id)}`)
  if (!response.ok) {
    const body = await readError(response)
    throw Object.assign(new Error(body.error), { code: body.code })
  }
  const json = (await response.json()) as { video: YoutubeVideo }
  return json.video
}

export async function fetchOwnedLibrary(): Promise<OwnedVideo[]> {
  const response = await fetch('/api/library')
  if (!response.ok) {
    const body = await readError(response)
    throw Object.assign(new Error(body.error), { code: body.code })
  }
  const json = (await response.json()) as { items: OwnedVideo[] }
  return json.items
}

export async function inspectVideoQuality(source: 'youtube' | 'cleanstream', id: string): Promise<QualityInspection> {
  const params = new URLSearchParams({ source, id })
  const response = await fetch(`/api/enhance/quality?${params}`)
  if (!response.ok) {
    const body = await readError(response)
    throw Object.assign(new Error(body.error), { code: body.code })
  }
  return response.json() as Promise<QualityInspection>
}

export async function queueEnhancement(fileId: string): Promise<EnhanceJob> {
  const response = await fetch('/api/enhance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId }),
  })
  if (!response.ok) {
    const body = await readError(response)
    throw Object.assign(new Error(body.error), { code: body.code })
  }
  return response.json() as Promise<EnhanceJob>
}

export async function fetchEnhanceJob(jobId: string): Promise<EnhanceJob> {
  const response = await fetch(`/api/enhance/jobs/${encodeURIComponent(jobId)}`)
  if (!response.ok) {
    const body = await readError(response)
    throw Object.assign(new Error(body.error), { code: body.code })
  }
  return response.json() as Promise<EnhanceJob>
}

export function enhancedMediaUrl(outputId: string): string {
  return `/api/enhance/media/${encodeURIComponent(outputId)}`
}

export async function uploadAuthorizedVideo(file: File): Promise<{ fileId: string; job: EnhanceJob }> {
  const response = await fetch('/api/enhance/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'video/mp4' },
    body: file,
  })
  if (!response.ok) {
    const body = await readError(response)
    throw Object.assign(new Error(body.error), { code: body.code })
  }
  return response.json() as Promise<{ fileId: string; job: EnhanceJob }>
}

export async function fetchOwnedVideo(id: string): Promise<OwnedVideo> {
  const response = await fetch(`/api/library/${encodeURIComponent(id)}`)
  if (!response.ok) {
    const body = await readError(response)
    throw Object.assign(new Error(body.error), { code: body.code })
  }
  const json = (await response.json()) as { video: OwnedVideo }
  return json.video
}

export async function applyVideoLanguage(input: {
  videoId: string
  language: string
  mode: VideoLanguageMode
}): Promise<VideoLanguageTrack> {
  const response = await fetch('/api/video-language', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const result = (await response.json()) as VideoLanguageTrack & ApiErrorBody
  if (!response.ok) {
    throw Object.assign(new Error(result.error || 'Translation failed'), { code: result.code })
  }
  return result
}

export async function fetchVideoLanguageJob(jobId: string): Promise<VideoLanguageTrack> {
  const response = await fetch(`/api/video-language/jobs/${encodeURIComponent(jobId)}`)
  if (!response.ok) {
    const body = await readError(response)
    throw Object.assign(new Error(body.error), { code: body.code })
  }
  return response.json() as Promise<VideoLanguageTrack>
}

export function videoLanguageTrackUrl(videoId: string, language: VideoLanguageCode): string {
  return `/api/video-language/media/${encodeURIComponent(videoId)}/${language}.vtt`
}
