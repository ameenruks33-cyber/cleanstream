import type { ApiErrorBody, EnhanceJob, OwnedVideo, QualityInspection, YoutubeSearchResponse, YoutubeVideo } from '@/types'

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
  supabaseConfigured: boolean
}> {
  const response = await fetch('/api/health')
  if (!response.ok) {
    return { ok: false, youtubeConfigured: false, supabaseConfigured: false }
  }
  return response.json() as Promise<{ ok: boolean; youtubeConfigured: boolean; supabaseConfigured: boolean }>
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
