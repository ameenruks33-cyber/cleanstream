const OFFICIAL_WATCH_HOSTS = new Set([
  'justwatch.com',
  'www.justwatch.com',
  'themoviedb.org',
  'www.themoviedb.org',
])

export function isOfficialWatchLink(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  if (url.username || url.password) return false
  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost')) return false
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false
  if (host.includes(':')) return false
  return OFFICIAL_WATCH_HOSTS.has(host) || host.endsWith('.justwatch.com')
}

export function sanitizeOfficialWatchLink(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  if (!trimmed || trimmed.length > 2000) return undefined
  return isOfficialWatchLink(trimmed) ? trimmed : undefined
}

export const TMDB_ATTRIBUTION =
  'This product uses the TMDB API but is not endorsed or certified by TMDB.'
export const JUSTWATCH_ATTRIBUTION = 'Streaming availability data is provided by JustWatch.'
export const WIKIDATA_ATTRIBUTION =
  'Movie facts are from Wikidata and Wikipedia, available under CC BY-SA.'

export const TMDB_LOGIN_API_URL =
  'https://www.themoviedb.org/login?redirect_to=%2Fsettings%2Fapi'
export const TMDB_SIGNUP_URL = 'https://www.themoviedb.org/signup'

export function justWatchSearchUrl(country: string, title: string): string | undefined {
  const cc = country.trim().toLowerCase()
  if (!/^[a-z]{2}$/.test(cc)) return undefined
  const q = title.trim().replace(/\s+/g, ' ').slice(0, 180)
  if (!q) return undefined
  return sanitizeOfficialWatchLink(`https://www.justwatch.com/${cc}/search?q=${encodeURIComponent(q)}`)
}
