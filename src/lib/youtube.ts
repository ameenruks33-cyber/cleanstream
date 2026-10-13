import { YOUTUBE_ID_RE } from './validation.ts'

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
  'www.youtu.be',
])

function looksLikeBareVideoId(text: string): boolean {
  if (!YOUTUBE_ID_RE.test(text)) return false
  const hasDigit = /\d/.test(text)
  const mixedCase = /[a-z]/.test(text) && /[A-Z]/.test(text)
  const hasSeparator = /[_-]/.test(text)
  return hasDigit || mixedCase || hasSeparator
}

export function extractYoutubeVideoId(raw: string): string | null {
  const text = raw.trim()
  if (!text) return null
  if (looksLikeBareVideoId(text)) return text

  let url: URL
  try {
    url = new URL(text)
  } catch {
    try {
      url = new URL(`https://${text}`)
    } catch {
      return null
    }
  }

  if (!YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return null

  const fromQuery = url.searchParams.get('v')
  if (fromQuery && YOUTUBE_ID_RE.test(fromQuery)) return fromQuery

  const parts = url.pathname.split('/').filter(Boolean)
  const host = url.hostname.replace(/^www\./i, '').toLowerCase()
  if (host === 'youtu.be' && parts[0] && YOUTUBE_ID_RE.test(parts[0])) {
    return parts[0]
  }

  const nested = new Set(['shorts', 'embed', 'live', 'v', 'e'])
  if (parts[0] && nested.has(parts[0].toLowerCase()) && parts[1] && YOUTUBE_ID_RE.test(parts[1])) {
    return parts[1]
  }

  return null
}

export function youtubeWatchPath(videoId: string): string {
  return `/watch/youtube/${videoId}`
}

export function searchOrWatchPath(raw: string): string | null {
  const id = extractYoutubeVideoId(raw)
  if (id) return youtubeWatchPath(id)
  const query = raw.trim()
  if (!query) return null
  return `/search?q=${encodeURIComponent(query)}`
}

export function youtubeWebsiteSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
}
