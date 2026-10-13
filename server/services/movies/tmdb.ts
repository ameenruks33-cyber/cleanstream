import { JUSTWATCH_ATTRIBUTION } from '../../../src/lib/movieLinks.ts'
import { sanitizeOfficialWatchLink } from '../../../src/lib/movieLinks.ts'
import { detectTmdbLanguage } from '../../../src/lib/queryLanguage.ts'
import { YOUTUBE_ID_RE } from '../../../src/lib/validation.ts'
import type { AvailabilityType, MovieDetails, MoviePerson, MovieSummary, StreamingOffer } from '../../../src/types/movies.ts'
import { isTmdbConfigured, type Env } from '../../config/env.ts'
import type { AvailabilityResult, MovieDetailsInput, MovieMetadataProvider, MovieSearchInput, StreamingAvailabilityProvider } from './providers.ts'

const TMDB_API_ORIGIN = 'https://api.themoviedb.org'
const TMDB_IMAGE_ORIGIN = 'https://image.tmdb.org'
const FETCH_TIMEOUT_MS = 8000
const USER_AGENT = 'MyTube/1.0'

type TmdbProviderOffer = {
  provider_id?: number
  provider_name?: string
  logo_path?: string | null
}

type TmdbWatchCountry = {
  link?: string
  flatrate?: TmdbProviderOffer[]
  rent?: TmdbProviderOffer[]
  buy?: TmdbProviderOffer[]
  ads?: TmdbProviderOffer[]
  free?: TmdbProviderOffer[]
}

type TmdbMoviePayload = {
  id?: number
  title?: string
  original_title?: string
  original_language?: string
  overview?: string
  poster_path?: string | null
  release_date?: string
  popularity?: number
  vote_average?: number
  backdrop_path?: string | null
  runtime?: number | null
  tagline?: string
  genres?: Array<{ name?: string }>
  spoken_languages?: Array<{ iso_639_1?: string; english_name?: string; name?: string }>
  credits?: {
    cast?: Array<{ id?: number; name?: string; character?: string; order?: number }>
    crew?: Array<{ id?: number; name?: string; job?: string }>
  }
  alternative_titles?: { titles?: Array<{ title?: string }> }
  'watch/providers'?: { results?: Record<string, TmdbWatchCountry> }
  videos?: { results?: TmdbVideo[] }
}

type TmdbVideo = {
  site?: string
  type?: string
  official?: boolean
  key?: string
}

type TmdbSearchPayload = {
  page?: number
  total_results?: number
  results?: TmdbMoviePayload[]
}

export class MovieServiceError extends Error {
  status: number
  code: string
  constructor(message: string, status = 502, code = 'MOVIE_ERROR') {
    super(message)
    this.name = 'MovieServiceError'
    this.status = status
    this.code = code
  }
}

const rawCache = new Map<string, { expires: number; value: unknown }>()
const CACHE_TTL_MS = 15 * 60 * 1000
const DETAILS_TTL_MS = 6 * 60 * 60 * 1000
const CACHE_MAX = 400

function cacheGet<T>(key: string): T | undefined {
  const hit = rawCache.get(key)
  if (!hit) return undefined
  if (hit.expires < Date.now()) {
    rawCache.delete(key)
    return undefined
  }
  return hit.value as T
}

function cacheSet(key: string, value: unknown, ttl = CACHE_TTL_MS): void {
  if (rawCache.size >= CACHE_MAX) {
    const first = rawCache.keys().next().value
    if (typeof first === 'string') rawCache.delete(first)
  }
  rawCache.set(key, { expires: Date.now() + ttl, value })
}

export function clearMovieCache(): void {
  rawCache.clear()
}

function tmdbImage(path: string | null | undefined, size: 'w92' | 'w500' = 'w500'): string {
  if (!path || typeof path !== 'string' || !path.startsWith('/') || path.includes('://') || path.length > 200) {
    return ''
  }
  return `${TMDB_IMAGE_ORIGIN}/t/p/${size}${path}`
}

function yearFromDate(date?: string): number | undefined {
  if (!date || date.length < 4) return undefined
  const year = Number(date.slice(0, 4))
  return Number.isInteger(year) && year >= 1870 ? year : undefined
}

function mapSummary(item: TmdbMoviePayload): MovieSummary | null {
  const id = Number(item.id)
  if (!Number.isInteger(id) || id < 1) return null
  return {
    id: String(id),
    title: (item.title || item.original_title || 'Untitled').trim(),
    originalTitle: (item.original_title || item.title || '').trim(),
    originalLanguage: (item.original_language || '').trim(),
    year: yearFromDate(item.release_date),
    posterUrl: tmdbImage(item.poster_path),
    backdropUrl: tmdbImage(item.backdrop_path, 'w500'),
    overview: (item.overview || '').trim(),
    popularity: typeof item.popularity === 'number' ? item.popularity : 0,
    voteAverage: typeof item.vote_average === 'number' ? item.vote_average : undefined,
    source: 'tmdb',
    tmdbId: id,
  }
}

async function tmdbGet(env: Env, pathname: string, params: Record<string, string>): Promise<unknown> {
  if (!isTmdbConfigured(env)) {
    throw new MovieServiceError(
      'Movie search needs a TMDB API key on the server. Add TMDB_API_KEY in .env.',
      503,
      'TMDB_NOT_CONFIGURED',
    )
  }
  if (!pathname.startsWith('/3/')) {
    throw new MovieServiceError('Invalid TMDB path.', 500, 'INVALID_TMDB_PATH')
  }
  const url = new URL(pathname, TMDB_API_ORIGIN)
  if (url.origin !== TMDB_API_ORIGIN) {
    throw new MovieServiceError('Refusing to call a non-TMDB host.', 500, 'SSRF_BLOCKED')
  }
  url.searchParams.set('api_key', env.TMDB_API_KEY)
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value)
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
      signal: controller.signal,
    })
    const text = await response.text()
    if (response.status === 401 || response.status === 403) {
      throw new MovieServiceError('TMDB rejected the API key. Check TMDB_API_KEY and its permissions.', 403, 'TMDB_FORBIDDEN')
    }
    if (response.status === 404) {
      throw new MovieServiceError('Movie not found.', 404, 'MOVIE_NOT_FOUND')
    }
    if (response.status === 429) {
      throw new MovieServiceError('TMDB rate limit reached. Try again in a minute.', 429, 'TMDB_RATE_LIMIT')
    }
    if (!response.ok) {
      throw new MovieServiceError('TMDB could not complete this request.', response.status >= 400 ? response.status : 502, 'TMDB_ERROR')
    }
    if (!text.trim().startsWith('{') && !text.trim().startsWith('[')) {
      throw new MovieServiceError('TMDB returned an unexpected payload.', 502, 'TMDB_ERROR')
    }
    return JSON.parse(text) as unknown
  } catch (error) {
    if (error instanceof MovieServiceError) throw error
    throw new MovieServiceError('Could not reach TMDB right now.', 502, 'TMDB_UNAVAILABLE')
  } finally {
    clearTimeout(timer)
  }
}

function mapPeople(
  items: Array<{ id?: number; name?: string; character?: string; job?: string; order?: number }> | undefined,
  kind: 'cast' | 'crew',
  limit: number,
): MoviePerson[] {
  if (!items) return []
  const selected =
    kind === 'cast'
      ? [...items].sort((a, b) => (a.order ?? 99) - (b.order ?? 99)).slice(0, limit)
      : items.filter((person) => person.job === 'Director' || person.job === 'Writer').slice(0, limit)
  return selected.flatMap((person) => {
    const id = Number(person.id)
    const name = (person.name || '').trim()
    if (!Number.isInteger(id) || !name) return []
    return [{ id, name, role: (person.character || person.job || '').trim() }]
  })
}

function availabilityTypeFromKey(key: string): AvailabilityType | undefined {
  if (key === 'flatrate') return 'subscription'
  if (key === 'rent') return 'rental'
  if (key === 'buy') return 'purchase'
  if (key === 'ads') return 'ads'
  if (key === 'free') return 'free'
  return undefined
}

export function pickYoutubeTrailerId(videos: TmdbVideo[] | undefined): string | undefined {
  if (!videos?.length) return undefined
  const ranked = videos
    .filter((video) => video.site === 'YouTube' && typeof video.key === 'string' && YOUTUBE_ID_RE.test(video.key))
    .map((video) => {
      const type = video.type || ''
      let rank = 9
      if (video.official && type === 'Trailer') rank = 0
      else if (type === 'Trailer') rank = 1
      else if (video.official && type === 'Teaser') rank = 2
      else if (type === 'Teaser') rank = 3
      else if (type === 'Clip') rank = 4
      return { key: video.key as string, rank }
    })
    .sort((a, b) => a.rank - b.rank)
  return ranked[0]?.key
}

export function mapWatchOffers(payload: TmdbMoviePayload, country: string, verifiedAt: string): AvailabilityResult {
  const region = payload['watch/providers']?.results?.[country]
  const justWatchUrl = sanitizeOfficialWatchLink(region?.link)
  if (!region) {
    return {
      offers: [],
      justWatchUrl,
      status: 'unavailable',
      note: `No confirmed official viewing options in ${country} yet. Availability is regional and can change.`,
    }
  }
  const buckets: Array<[string, TmdbProviderOffer[] | undefined]> = [
    ['free', region.free],
    ['ads', region.ads],
    ['flatrate', region.flatrate],
    ['rent', region.rent],
    ['buy', region.buy],
  ]
  const offers: StreamingOffer[] = []
  const seen = new Set<string>()
  for (const [bucket, list] of buckets) {
    const availabilityType = availabilityTypeFromKey(bucket)
    if (!availabilityType || !list) continue
    for (const item of list) {
      const providerId = Number(item.provider_id)
      const providerName = (item.provider_name || '').trim()
      if (!Number.isInteger(providerId) || !providerName) continue
      const key = `${providerId}:${availabilityType}`
      if (seen.has(key)) continue
      seen.add(key)
      offers.push({
        providerId,
        providerName,
        logoUrl: tmdbImage(item.logo_path, 'w92'),
        availabilityType,
        country,
        officialUrl: justWatchUrl ?? '',
        source: 'justwatch-tmdb',
        lastVerifiedAt: verifiedAt,
      })
    }
  }
  if (offers.length === 0) {
    return {
      offers: [],
      justWatchUrl,
      status: 'unavailable',
      note: `JustWatch lists this title for ${country}, but no subscription, rental, purchase, or free option is confirmed right now.`,
    }
  }
  return {
    offers,
    justWatchUrl,
    status: 'confirmed',
    note: `${JUSTWATCH_ATTRIBUTION} Offers below are for ${country} and were last verified from TMDB’s licensed JustWatch feed.`,
  }
}

export function mapMovieDetails(
  payload: TmdbMoviePayload,
  country: string,
  verifiedAt: string,
): MovieDetails | null {
  const summary = mapSummary(payload)
  if (!summary) return null
  const availability = mapWatchOffers(payload, country, verifiedAt)
  const spoken = (payload.spoken_languages ?? [])
    .map((lang) => lang.english_name || lang.name || lang.iso_639_1 || '')
    .map((value) => value.trim())
    .filter(Boolean)
  const alternateTitles = Array.from(
    new Set(
      (payload.alternative_titles?.titles ?? [])
        .map((item) => (item.title || '').trim())
        .filter((title) => title && title !== summary.title),
    ),
  ).slice(0, 12)
  return {
    ...summary,
    tagline: payload.tagline?.trim() || undefined,
    runtimeMinutes: typeof payload.runtime === 'number' && payload.runtime > 0 ? payload.runtime : undefined,
    releaseDate: payload.release_date || undefined,
    genres: (payload.genres ?? []).map((genre) => (genre.name || '').trim()).filter(Boolean),
    spokenLanguages: spoken,
    alternateTitles,
    cast: mapPeople(payload.credits?.cast, 'cast', 12),
    crew: mapPeople(payload.credits?.crew, 'crew', 8),
    offers: availability.offers,
    availabilityStatus: availability.status,
    availabilityNote: availability.note,
    justWatchUrl: availability.justWatchUrl,
    country,
    trailerYoutubeId: pickYoutubeTrailerId(payload.videos?.results),
    inAppPlayback: { kind: 'none' },
  }
}

export class TmdbClient {
  constructor(private readonly env: Env) {}

  async search(input: MovieSearchInput): Promise<{ items: MovieSummary[]; totalResults: number; page: number }> {
    const page = Math.min(Math.max(input.page ?? 1, 1), 20)
    const language = input.language || detectTmdbLanguage(input.query) || 'en-US'
    const cacheKey = `search:${input.query}:${input.year ?? ''}:${language}:${input.originalLanguage ?? ''}:${page}`
    const cached = cacheGet<{ items: MovieSummary[]; totalResults: number; page: number }>(cacheKey)
    if (cached) return cached
    const run = async (year?: number) =>
      (await tmdbGet(this.env, '/3/search/movie', {
        query: input.query,
        include_adult: 'false',
        language,
        page: String(page),
        ...(year ? { primary_release_year: String(year), year: String(year) } : {}),
      })) as TmdbSearchPayload
    let payload = await run(input.year)
    let items = (payload.results ?? []).flatMap((item) => {
      const mapped = mapSummary(item)
      return mapped ? [mapped] : []
    })
    if (input.year && items.length === 0) {
      payload = await run(undefined)
      items = (payload.results ?? []).flatMap((item) => {
        const mapped = mapSummary(item)
        return mapped ? [mapped] : []
      })
    }
    if (input.originalLanguage) {
      items = items.filter((item) => item.originalLanguage === input.originalLanguage)
    }
    const result = {
      items,
      totalResults: Number(payload.total_results) || items.length,
      page: Number(payload.page) || page,
    }
    cacheSet(cacheKey, result)
    return result
  }

  async movie(id: number, language = 'en-US'): Promise<TmdbMoviePayload> {
    const cacheKey = `movie:${id}:${language}`
    const cached = cacheGet<TmdbMoviePayload>(cacheKey)
    if (cached) return cached
    const payload = (await tmdbGet(this.env, `/3/movie/${id}`, {
      language,
      append_to_response: 'credits,alternative_titles,watch/providers,videos',
    })) as TmdbMoviePayload
    cacheSet(cacheKey, payload, DETAILS_TTL_MS)
    return payload
  }
}

export class TmdbMetadataProvider implements MovieMetadataProvider {
  constructor(private readonly client: TmdbClient) {}

  search(input: MovieSearchInput) {
    return this.client.search(input)
  }

  async getDetails(input: MovieDetailsInput) {
    const payload = await this.client.movie(Number(input.id), input.language || 'en-US')
    const mapped = mapMovieDetails(payload, 'AE', new Date().toISOString())
    if (!mapped) throw new MovieServiceError('Movie not found.', 404, 'MOVIE_NOT_FOUND')
    const { offers, availabilityStatus, availabilityNote, justWatchUrl, country, ...details } = mapped
    void offers
    void availabilityStatus
    void availabilityNote
    void justWatchUrl
    void country
    return details
  }
}

export class TmdbJustWatchAvailabilityProvider implements StreamingAvailabilityProvider {
  constructor(private readonly client: TmdbClient) {}

  async getOffers(movieId: string, country: string): Promise<AvailabilityResult> {
    const payload = await this.client.movie(Number(movieId))
    return mapWatchOffers(payload, country, new Date().toISOString())
  }
}
