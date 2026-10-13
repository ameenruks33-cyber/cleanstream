import type { MovieDetails, MoviePerson, MovieSummary } from '../../../src/types/movies.ts'
import { MovieServiceError } from './tmdb.ts'
import type { MovieDetailsInput, MovieMetadataProvider, MovieSearchInput } from './providers.ts'

const WIKIDATA_ORIGIN = 'https://www.wikidata.org'
const FETCH_TIMEOUT_MS = 8000
const USER_AGENT = 'MyTube/1.0 (legal-movie-discovery; https://cleanstream-two.vercel.app)'
const FILM_TYPES = new Set([
  'Q11424',
  'Q24869',
  'Q202866',
  'Q229390',
  'Q226730',
  'Q43054',
  'Q1261214',
  'Q18011172',
  'Q25110269',
  'Q29168811',
])
const WIKI_HOSTS = new Set([
  'en.wikipedia.org',
  'ar.wikipedia.org',
  'hi.wikipedia.org',
  'fr.wikipedia.org',
  'de.wikipedia.org',
  'es.wikipedia.org',
  'ja.wikipedia.org',
  'ko.wikipedia.org',
  'tr.wikipedia.org',
  'pt.wikipedia.org',
])

type WikiSearchHit = { id?: string; label?: string; description?: string }
type WikiEntity = {
  id?: string
  labels?: Record<string, { value?: string }>
  descriptions?: Record<string, { value?: string }>
  aliases?: Record<string, Array<{ value?: string }>>
  claims?: Record<string, WikiClaim[]>
  sitelinks?: Record<string, { title?: string }>
}
type WikiClaim = {
  mainsnak?: {
    datavalue?: {
      value?: string | { id?: string; time?: string; amount?: string; 'text-language'?: string; text?: string }
    }
  }
}

const cache = new Map<string, { expires: number; value: unknown }>()

function cacheGet<T>(key: string): T | undefined {
  const hit = cache.get(key)
  if (!hit || hit.expires < Date.now()) {
    if (hit) cache.delete(key)
    return undefined
  }
  return hit.value as T
}

function cacheSet(key: string, value: unknown): void {
  cache.set(key, { expires: Date.now() + 15 * 60 * 1000, value })
}

export function clearWikidataCache(): void {
  cache.clear()
}

async function wikiGet(origin: string, pathname: string, params: Record<string, string>): Promise<unknown> {
  const allowed = origin === WIKIDATA_ORIGIN || WIKI_HOSTS.has(new URL(origin).host)
  if (!allowed) throw new MovieServiceError('Refusing to call an unknown host.', 500, 'SSRF_BLOCKED')
  const url = new URL(pathname, origin)
  if (url.origin !== origin) throw new MovieServiceError('Refusing to call an unknown host.', 500, 'SSRF_BLOCKED')
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value)
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: controller.signal,
    })
    const finalHost = new URL(response.url).hostname
    const finalOrigin = new URL(response.url).origin
    if (finalOrigin !== origin && finalOrigin !== WIKIDATA_ORIGIN && !WIKI_HOSTS.has(finalHost)) {
      throw new MovieServiceError('Refusing to follow a redirect off the allowlist.', 500, 'SSRF_BLOCKED')
    }
    const text = await response.text()
    if (!response.ok || (!text.trim().startsWith('{') && !text.trim().startsWith('['))) {
      throw new MovieServiceError('Wikidata could not complete this request.', 502, 'WIKIDATA_ERROR')
    }
    return JSON.parse(text) as unknown
  } catch (error) {
    if (error instanceof MovieServiceError) throw error
    throw new MovieServiceError('Could not reach Wikidata right now.', 502, 'WIKIDATA_UNAVAILABLE')
  } finally {
    clearTimeout(timer)
  }
}

function claimValues(entity: WikiEntity, property: string): Array<string | Record<string, string>> {
  return (entity.claims?.[property] ?? []).flatMap((claim) => {
    const value = claim.mainsnak?.datavalue?.value
    if (!value) return []
    return [value as string | Record<string, string>]
  })
}

function entityIds(entity: WikiEntity, property: string): string[] {
  return claimValues(entity, property).flatMap((value) => {
    if (value && typeof value === 'object' && typeof value.id === 'string') return [value.id]
    return []
  })
}

function firstTime(entity: WikiEntity, property: string): string | undefined {
  for (const value of claimValues(entity, property)) {
    if (value && typeof value === 'object' && typeof value.time === 'string') return value.time
  }
  return undefined
}

function commonsImage(filename: unknown): string {
  if (typeof filename !== 'string' || filename.includes('://') || filename.includes('..') || filename.length > 240) {
    return ''
  }
  const trimmed = filename.replace(/^File:/i, '').trim()
  if (!trimmed) return ''
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(trimmed)}?width=500`
}

function yearFromWikidata(entity: WikiEntity): number | undefined {
  const time = firstTime(entity, 'P577')
  if (!time) return undefined
  const year = Number(time.replace(/^\+/, '').slice(0, 4))
  return Number.isInteger(year) && year >= 1870 ? year : undefined
}

function isFilm(entity: WikiEntity, description: string): boolean {
  if (entityIds(entity, 'P31').some((id) => FILM_TYPES.has(id))) return true
  return /\b(film|movie|cin[eé]ma)\b/i.test(description)
}

function labelOf(entity: WikiEntity, language: string): string {
  return (
    entity.labels?.[language]?.value ||
    entity.labels?.en?.value ||
    entity.id ||
    'Untitled'
  ).trim()
}

function qNumber(id: string): number {
  const n = Number(id.replace(/^Q/, ''))
  return Number.isInteger(n) ? n : 0
}

function mapSummary(entity: WikiEntity, language: string): MovieSummary | null {
  const id = entity.id
  if (!id || !/^Q[1-9]\d{0,11}$/.test(id)) return null
  const description = entity.descriptions?.[language]?.value || entity.descriptions?.en?.value || ''
  if (!isFilm(entity, description) && entityIds(entity, 'P4947').length === 0) return null
  const tmdbRaw = claimValues(entity, 'P4947')[0]
  const tmdbId = typeof tmdbRaw === 'string' ? Number(tmdbRaw) : undefined
  const image = claimValues(entity, 'P18')[0]
  const languageId = entityIds(entity, 'P364')[0]
  return {
    id,
    title: labelOf(entity, language),
    originalTitle: entity.labels?.[language]?.value || labelOf(entity, language),
    originalLanguage: languageId ? languageId.replace(/^Q/, '').slice(0, 8).toLowerCase() : language,
    year: yearFromWikidata(entity),
    posterUrl: commonsImage(image),
    overview: description.trim(),
    popularity: 0,
    source: 'wikidata',
    tmdbId: Number.isInteger(tmdbId) ? tmdbId : undefined,
  }
}

async function getEntities(ids: string[], language: string): Promise<WikiEntity[]> {
  if (ids.length === 0) return []
  const payload = (await wikiGet(WIKIDATA_ORIGIN, '/w/api.php', {
    action: 'wbgetentities',
    format: 'json',
    ids: ids.join('|'),
    languages: `${language}|en`,
    props: 'labels|descriptions|aliases|claims|sitelinks',
    origin: '*',
  })) as { entities?: Record<string, WikiEntity> }
  return Object.values(payload.entities ?? {})
}

async function wikipediaOverview(entity: WikiEntity, language: string): Promise<{ overview: string; posterUrl: string }> {
  const wikiKey = language === 'en' ? 'enwiki' : `${language}wiki`
  const title = entity.sitelinks?.[wikiKey]?.title || entity.sitelinks?.enwiki?.title
  const host = language === 'en' || !entity.sitelinks?.[wikiKey] ? 'en.wikipedia.org' : `${language}.wikipedia.org`
  if (!title || !WIKI_HOSTS.has(host)) return { overview: '', posterUrl: '' }
  try {
    const payload = (await wikiGet(
      `https://${host}`,
      `/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`,
      {},
    )) as { extract?: string; thumbnail?: { source?: string } }
    const poster = payload.thumbnail?.source
    let posterUrl = ''
    if (typeof poster === 'string') {
      try {
        const url = new URL(poster)
        if (url.protocol === 'https:' && (url.hostname === 'upload.wikimedia.org' || url.hostname === 'commons.wikimedia.org')) {
          posterUrl = url.toString()
        }
      } catch {
        posterUrl = ''
      }
    }
    return { overview: (payload.extract || '').trim(), posterUrl }
  } catch {
    return { overview: '', posterUrl: '' }
  }
}

function peopleFrom(entities: WikiEntity[], language: string, role: string): MoviePerson[] {
  return entities.flatMap((entity) => {
    const name = labelOf(entity, language)
    if (!entity.id || name.startsWith('Q')) return []
    return [{ id: qNumber(entity.id), name, role }]
  })
}

export class WikidataMetadataProvider implements MovieMetadataProvider {
  async search(input: MovieSearchInput) {
    const language = input.language || 'en'
    const cacheKey = `wd:${input.query}:${input.year ?? ''}:${language}:${input.page ?? 1}`
    const cached = cacheGet<{ items: MovieSummary[]; totalResults: number; page: number }>(cacheKey)
    if (cached) return cached
    const payload = (await wikiGet(WIKIDATA_ORIGIN, '/w/api.php', {
      action: 'wbsearchentities',
      format: 'json',
      language,
      uselang: language,
      type: 'item',
      limit: '20',
      search: input.query,
      origin: '*',
    })) as { search?: WikiSearchHit[] }
    const ids = (payload.search ?? []).flatMap((hit) => (hit.id && /^Q[1-9]\d{0,11}$/.test(hit.id) ? [hit.id] : []))
    const entities = await getEntities(ids, language)
    let items = entities.flatMap((entity) => {
      const mapped = mapSummary(entity, language)
      return mapped ? [mapped] : []
    })
    if (input.year) items = items.filter((item) => item.year === input.year)
    const result = { items, totalResults: items.length, page: 1 }
    cacheSet(cacheKey, result)
    return result
  }

  async getDetails(input: MovieDetailsInput) {
    const language = input.language || 'en'
    const entities = await getEntities([input.id], language)
    const entity = entities[0]
    const summary = entity ? mapSummary(entity, language) : null
    if (!entity || !summary) throw new MovieServiceError('Movie not found.', 404, 'MOVIE_NOT_FOUND')
    const wiki = await wikipediaOverview(entity, language)
    const aliases = (entity.aliases?.[language] || entity.aliases?.en || [])
      .map((item) => (item.value || '').trim())
      .filter((title) => title && title !== summary.title)
      .slice(0, 12)
    const runtimeRaw = claimValues(entity, 'P2047')[0]
    const runtime =
      runtimeRaw && typeof runtimeRaw === 'object' && 'amount' in runtimeRaw
        ? Number(String(runtimeRaw.amount).replace(/^[+]/, ''))
        : undefined
    const personIds = [...entityIds(entity, 'P161').slice(0, 8), ...entityIds(entity, 'P57').slice(0, 3)]
    const peopleEntities = await getEntities(personIds, language)
    const castIds = new Set(entityIds(entity, 'P161'))
    const crewIds = new Set(entityIds(entity, 'P57'))
    const details: Omit<
      MovieDetails,
      'offers' | 'availabilityStatus' | 'availabilityNote' | 'justWatchUrl' | 'country' | 'inAppPlayback'
    > = {
      ...summary,
      overview: wiki.overview || summary.overview,
      posterUrl: summary.posterUrl || wiki.posterUrl,
      releaseDate: firstTime(entity, 'P577')?.replace(/^\+/, '').slice(0, 10),
      runtimeMinutes: Number.isFinite(runtime) && (runtime as number) > 0 ? Math.round(runtime as number) : undefined,
      genres: [],
      spokenLanguages: [],
      alternateTitles: aliases,
      cast: peopleFrom(peopleEntities.filter((person) => person.id && castIds.has(person.id)), language, 'Cast'),
      crew: peopleFrom(peopleEntities.filter((person) => person.id && crewIds.has(person.id)), language, 'Director'),
    }
    return details
  }
}
