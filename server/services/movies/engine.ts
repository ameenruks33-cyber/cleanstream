import { DEFAULT_WATCH_REGION, isWatchRegion, WATCH_REGIONS } from '../../../src/data/watchRegions.ts'
import { authorizedAccessFromOffers, sortMoviesByAuthorizedAccess } from '../../../src/lib/authorizedAccess.ts'
import { JUSTWATCH_ATTRIBUTION, TMDB_ATTRIBUTION, WIKIDATA_ATTRIBUTION } from '../../../src/lib/movieLinks.ts'
import type { MovieDetails, MovieNotification, MovieSearchResponse } from '../../../src/types/movies.ts'
import { isJustWatchPartnerConfigured, isTmdbConfigured, type Env } from '../../config/env.ts'
import { matchOwnedLibrary, resolveInAppPlayback, searchOwnedLibrary } from './authorizedLibrary.ts'
import { estimatedJustWatchAvailability, JustWatchSearchAvailabilityProvider } from './justwatch.ts'
import { enqueueMovieRefresh } from './jobs.ts'
import { OfferChangeNotificationProvider } from './notifications.ts'
import { HttpsOfficialPlaybackProvider } from './playback.ts'
import { offerFingerprint } from './providers.ts'
import { MovieServiceError, TmdbClient, TmdbJustWatchAvailabilityProvider, TmdbMetadataProvider } from './tmdb.ts'
import { WikidataMetadataProvider } from './wikidata.ts'

const engines = new WeakMap<Env, MovieEngine>()

export class MovieEngine {
  constructor(
    private readonly env: Env,
    private readonly tmdbMetadata: TmdbMetadataProvider,
    private readonly wikidataMetadata: WikidataMetadataProvider,
    private readonly tmdbAvailability: TmdbJustWatchAvailabilityProvider,
    private readonly searchAvailability: JustWatchSearchAvailabilityProvider,
    private readonly playback: HttpsOfficialPlaybackProvider,
    private readonly notifications: OfferChangeNotificationProvider,
  ) {}

  configured() {
    return {
      moviesConfigured: true,
      tmdbConfigured: isTmdbConfigured(this.env),
      justWatchPartnerConfigured: isJustWatchPartnerConfigured(this.env),
      defaultCountry: isWatchRegion(this.env.DEFAULT_WATCH_REGION) ? this.env.DEFAULT_WATCH_REGION : DEFAULT_WATCH_REGION,
    }
  }

  regions() {
    return {
      defaultCountry: this.configured().defaultCountry,
      regions: WATCH_REGIONS,
      note: 'The same title can appear on different services by country. United Arab Emirates (AE) is the default.',
    }
  }

  async search(input: {
    query: string
    year?: number
    language?: string
    originalLanguage?: string
    page?: number
    country?: string
  }): Promise<MovieSearchResponse> {
    const country = this.resolveCountry(input.country)
    const result = isTmdbConfigured(this.env)
      ? await this.tmdbMetadata.search(input)
      : await this.wikidataMetadata.search(input)
    const items = sortMoviesByAuthorizedAccess(
      await Promise.all(
        result.items.map(async (item, index) => {
          const ownedVideoId = matchOwnedLibrary(item.title, item.originalTitle, item.year)?.videoId
          if (index >= 8 || item.id.startsWith('Q') || !isTmdbConfigured(this.env)) {
            return {
              ...item,
              ownedVideoId,
              authorizedAccess: authorizedAccessFromOffers(ownedVideoId, []),
            }
          }
          try {
            const availability = await this.tmdbAvailability.getOffers(item.id, country)
            return {
              ...item,
              ownedVideoId,
              authorizedAccess: authorizedAccessFromOffers(
                ownedVideoId,
                availability.offers.map((offer) => offer.availabilityType),
              ),
            }
          } catch {
            return {
              ...item,
              ownedVideoId,
              authorizedAccess: authorizedAccessFromOffers(ownedVideoId, []),
            }
          }
        }),
      ),
    )
    for (const item of items.slice(0, 5)) {
      enqueueMovieRefresh(item.id, country)
    }
    return {
      items,
      libraryMatches: searchOwnedLibrary(input.query),
      page: result.page,
      totalResults: result.totalResults,
      country,
      attribution: {
        tmdb: isTmdbConfigured(this.env) ? TMDB_ATTRIBUTION : WIKIDATA_ATTRIBUTION,
        justWatch: JUSTWATCH_ATTRIBUTION,
      },
    }
  }

  async getMovie(id: string, countryRaw?: string, language?: string): Promise<MovieDetails> {
    const country = this.resolveCountry(countryRaw)
    const wikidata = id.startsWith('Q')
    if (!wikidata && !isTmdbConfigured(this.env)) {
      throw new MovieServiceError(
        'Search again from Movies. Confirmed TMDB ids need a TMDB API key after you log in to TMDB.',
        404,
        'MOVIE_NOT_FOUND',
      )
    }
    const details = wikidata
      ? await this.wikidataMetadata.getDetails({ id, language })
      : await this.tmdbMetadata.getDetails({ id, language })
    const tmdbOfferId = details.tmdbId ? String(details.tmdbId) : wikidata ? '' : id
    const availability =
      tmdbOfferId && isTmdbConfigured(this.env)
        ? await this.tmdbAvailability.getOffers(tmdbOfferId, country)
        : await this.searchAvailability.getOffers(id, country, details.title)
    const official = this.playback.filterOfficialUrls([
      availability.justWatchUrl,
      estimatedJustWatchAvailability(details.title, country).justWatchUrl,
      ...availability.offers.map((offer) => offer.officialUrl),
    ])
    const justWatchUrl = official[0]
    return {
      ...details,
      country,
      offers: availability.offers.map((offer) => ({
        ...offer,
        officialUrl: offer.officialUrl || justWatchUrl || '',
      })),
      availabilityStatus: availability.status,
      availabilityNote: availability.note,
      justWatchUrl,
      ownedVideoId: matchOwnedLibrary(details.title, details.originalTitle, details.year)?.videoId,
      inAppPlayback: resolveInAppPlayback({
        title: details.title,
        originalTitle: details.originalTitle,
        year: details.year,
        trailerYoutubeId: details.trailerYoutubeId,
      }),
    }
  }

  async refreshWatchlist(input: {
    ids: string[]
    country?: string
    previous?: Record<string, string>
  }): Promise<{ items: MovieDetails[]; notifications: MovieNotification[]; fingerprints: Record<string, string> }> {
    const country = this.resolveCountry(input.country)
    const ids = [...new Set(input.ids)].slice(0, 20)
    const notifications: MovieNotification[] = []
    const fingerprints: Record<string, string> = {}
    for (const id of ids) enqueueMovieRefresh(id, country)
    const items = await Promise.all(ids.map((id) => this.getMovie(id, country)))
    for (const movie of items) {
      const key = `${movie.id}:${country}`
      const fingerprint = offerFingerprint(movie.offers) || movie.justWatchUrl || ''
      fingerprints[key] = fingerprint
      const notice = this.notifications.diff({
        movieId: movie.id,
        title: movie.title,
        country,
        previousFingerprint: input.previous?.[key],
        offers: movie.offers,
      })
      if (notice) notifications.push(notice)
    }
    return { items, notifications, fingerprints }
  }

  resolveCountry(code?: string): string {
    const fallback = this.configured().defaultCountry
    if (!code) return fallback
    const normalized = code.trim().toUpperCase()
    return isWatchRegion(normalized) ? normalized : fallback
  }
}

export function getMovieEngine(env: Env): MovieEngine {
  const existing = engines.get(env)
  if (existing) return existing
  const client = new TmdbClient(env)
  const engine = new MovieEngine(
    env,
    new TmdbMetadataProvider(client),
    new WikidataMetadataProvider(),
    new TmdbJustWatchAvailabilityProvider(client),
    new JustWatchSearchAvailabilityProvider(),
    new HttpsOfficialPlaybackProvider(),
    new OfferChangeNotificationProvider(),
  )
  engines.set(env, engine)
  return engine
}
