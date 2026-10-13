import { afterEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.ts'
import { loadEnv } from '../config/env.ts'
import { clearWikidataCache } from '../services/movies/wikidata.ts'
import { clearMovieCache, mapWatchOffers, pickYoutubeTrailerId } from '../services/movies/tmdb.ts'
import { HttpsOfficialPlaybackProvider } from '../services/movies/playback.ts'
import { OfferChangeNotificationProvider } from '../services/movies/notifications.ts'

const TMDB_KEY = 'test-tmdb-key-123456'

function movieApp(extra: Record<string, string> = {}) {
  return createApp(
    loadEnv({
      NODE_ENV: 'test',
      PORT: '8787',
      APP_URL: 'http://localhost:5173',
      ...extra,
    } as NodeJS.ProcessEnv),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  clearMovieCache()
  clearWikidataCache()
})

const sampleMovie = {
  id: 438631,
  title: 'Dune',
  original_title: 'Dune',
  original_language: 'en',
  overview: 'A noble family is thrust into a war.',
  poster_path: '/dune.jpg',
  release_date: '2021-10-22',
  popularity: 90,
  runtime: 155,
  tagline: 'It begins.',
  genres: [{ name: 'Science Fiction' }],
  spoken_languages: [{ english_name: 'English', iso_639_1: 'en' }],
  credits: {
    cast: [{ id: 1, name: 'Timothée Chalamet', character: 'Paul', order: 0 }],
    crew: [{ id: 2, name: 'Denis Villeneuve', job: 'Director' }],
  },
  alternative_titles: { titles: [{ title: 'Dune: Part One' }] },
  'watch/providers': {
    results: {
      AE: {
        link: 'https://www.justwatch.com/ae/movie/dune',
        flatrate: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/netflix.jpg' }],
        rent: [{ provider_id: 2, provider_name: 'Apple TV', logo_path: '/apple.jpg' }],
      },
      US: {
        link: 'https://www.justwatch.com/us/movie/dune',
        buy: [{ provider_id: 2, provider_name: 'Apple TV', logo_path: '/apple.jpg' }],
      },
    },
  },
  videos: {
    results: [
      { site: 'YouTube', type: 'Teaser', official: true, key: 'teaserxxxxx' },
      { site: 'YouTube', type: 'Trailer', official: true, key: 'abcdefghijk' },
      { site: 'Vimeo', type: 'Trailer', official: true, key: 'notyoutube1' },
    ],
  },
}

function stubTmdb() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      expect(url.origin).toBe('https://api.themoviedb.org')
      expect(url.pathname.startsWith('/3/')).toBe(true)
      if (url.pathname === '/3/search/movie') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ page: 1, total_results: 1, results: [sampleMovie] }),
        }
      }
      if (url.pathname === '/3/movie/438631') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify(sampleMovie),
        }
      }
      return { ok: false, status: 404, text: async () => JSON.stringify({ status_message: 'not found' }) }
    }),
  )
}

function stubWikidata() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      expect(['https://www.wikidata.org', 'https://en.wikipedia.org']).toContain(url.origin)
      if (url.pathname === '/w/api.php' && url.searchParams.get('action') === 'wbsearchentities') {
        return {
          ok: true,
          status: 200,
          url: url.toString(),
          text: async () => JSON.stringify({ search: [{ id: 'Q72932', label: 'Dune', description: '2021 film' }] }),
        }
      }
      if (url.pathname === '/w/api.php' && url.searchParams.get('action') === 'wbgetentities') {
        return {
          ok: true,
          status: 200,
          url: url.toString(),
          text: async () =>
            JSON.stringify({
              entities: {
                Q72932: {
                  id: 'Q72932',
                  labels: { en: { value: 'Dune' } },
                  descriptions: { en: { value: '2021 film by Denis Villeneuve' } },
                  aliases: { en: [{ value: 'Dune: Part One' }] },
                  claims: {
                    P31: [{ mainsnak: { datavalue: { value: { id: 'Q11424' } } } }],
                    P577: [{ mainsnak: { datavalue: { value: { time: '+2021-10-22T00:00:00Z' } } } }],
                    P18: [{ mainsnak: { datavalue: { value: 'Dune (2021 film).jpg' } } }],
                  },
                  sitelinks: { enwiki: { title: 'Dune (2021 film)' } },
                },
              },
            }),
        }
      }
      if (url.pathname.includes('/api/rest_v1/page/summary/')) {
        return {
          ok: true,
          status: 200,
          url: url.toString(),
          text: async () => JSON.stringify({ extract: 'A noble family is thrust into a war.' }),
        }
      }
      return { ok: false, status: 404, url: url.toString(), text: async () => '{}' }
    }),
  )
}

describe('movie discovery API', () => {
  it('searches Wikidata without a TMDB login', async () => {
    stubWikidata()
    const app = movieApp()
    const search = await request(app).get('/api/movies/search?q=dune&country=AE')
    expect(search.status).toBe(200)
    expect(search.body.items[0]?.id).toBe('Q72932')
    expect(search.body.items[0]?.title).toBe('Dune')
    expect(search.body.attribution.tmdb).toMatch(/Wikidata/)

    const detail = await request(app).get('/api/movies/Q72932?country=AE')
    expect(detail.status).toBe(200)
    expect(detail.body.movie.availabilityStatus).toBe('estimated')
    expect(detail.body.movie.justWatchUrl).toMatch(/justwatch.com\/ae\/search/)
  })

  it('searches titles and returns UAE-aware availability on details', async () => {
    stubTmdb()
    const app = movieApp({ TMDB_API_KEY: TMDB_KEY })
    const search = await request(app).get('/api/movies/search?q=dune&country=AE')
    expect(search.status).toBe(200)
    expect(search.body.items[0]?.id).toBe('438631')
    expect(search.body.country).toBe('AE')
    expect(search.body.items[0]?.authorizedAccess).toBe('storefront')
    expect(search.body.attribution.justWatch).toMatch(/JustWatch/)

    const detail = await request(app).get('/api/movies/438631?country=AE')
    expect(detail.status).toBe(200)
    expect(detail.body.movie.availabilityStatus).toBe('confirmed')
    expect(detail.body.movie.offers.some((offer: { availabilityType: string }) => offer.availabilityType === 'subscription')).toBe(
      true,
    )
    expect(detail.body.movie.justWatchUrl).toBe('https://www.justwatch.com/ae/movie/dune')
    expect(detail.body.movie.trailerYoutubeId).toBe('abcdefghijk')
    expect(detail.body.movie.inAppPlayback).toEqual({ kind: 'youtube-trailer', videoId: 'abcdefghijk' })
    expect(search.body.libraryMatches).toEqual([])
  })

  it('treats missing country offers as unavailable, not confirmed', async () => {
    stubTmdb()
    const app = movieApp({ TMDB_API_KEY: TMDB_KEY })
    const detail = await request(app).get('/api/movies/438631?country=QA')
    expect(detail.status).toBe(200)
    expect(detail.body.movie.availabilityStatus).toBe('unavailable')
    expect(detail.body.movie.offers).toEqual([])
  })

  it('rejects invalid ids, years, and countries', async () => {
    const app = movieApp({ TMDB_API_KEY: TMDB_KEY })
    expect((await request(app).get('/api/movies/nope')).status).toBe(400)
    expect((await request(app).get('/api/movies/search?q=dune&year=12')).body.code).toBe('INVALID_YEAR')
    expect((await request(app).get('/api/movies/search?q=dune&country=XX')).body.code).toBe('INVALID_COUNTRY')
  })

  it('refreshes a watchlist and emits a notification when offers appear', async () => {
    stubTmdb()
    const app = movieApp({ TMDB_API_KEY: TMDB_KEY })
    const response = await request(app)
      .post('/api/movies/refresh')
      .send({ ids: ['438631'], country: 'AE', previous: { '438631:AE': '' } })
    expect(response.status).toBe(200)
    expect(response.body.items[0]?.title).toBe('Dune')
    expect(response.body.notifications[0]?.country).toBe('AE')
  })
})

describe('availability mapping', () => {
  it('prefers an official YouTube trailer over teasers and other hosts', () => {
    expect(
      pickYoutubeTrailerId([
        { site: 'YouTube', type: 'Clip', key: 'clipxxxxxxx' },
        { site: 'YouTube', type: 'Trailer', official: true, key: 'officialtr1' },
        { site: 'Vimeo', type: 'Trailer', official: true, key: 'vimeokeyxxx' },
      ]),
    ).toBe('officialtr1')
  })

  it('maps JustWatch TMDB buckets and drops unofficial links', () => {
    const result = mapWatchOffers(
      {
        'watch/providers': {
          results: {
            AE: {
              link: 'https://totally-not-legal.example/full-movie',
              free: [{ provider_id: 9, provider_name: 'Tubi', logo_path: '/t.png' }],
              ads: [{ provider_id: 10, provider_name: 'Pluto TV', logo_path: '/p.png' }],
              flatrate: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.png' }],
            },
          },
        },
      },
      'AE',
      '2026-01-01T00:00:00.000Z',
    )
    expect(result.status).toBe('confirmed')
    expect(result.justWatchUrl).toBeUndefined()
    expect(result.offers.map((offer) => offer.availabilityType)).toEqual(['free', 'ads', 'subscription'])
    const playback = new HttpsOfficialPlaybackProvider()
    expect(playback.filterOfficialUrls(['https://evil.example/movie', 'https://www.justwatch.com/ae/movie/dune'])).toEqual([
      'https://www.justwatch.com/ae/movie/dune',
    ])
  })

  it('notifies only when the offer fingerprint changes', () => {
    const provider = new OfferChangeNotificationProvider()
    const offers = [{ providerId: 8, providerName: 'Netflix', availabilityType: 'subscription' as const }]
    const first = provider.diff({ movieId: '1', title: 'Dune', country: 'AE', offers })
    expect(first?.message).toMatch(/Official viewing options/)
    const same = provider.diff({
      movieId: '1',
      title: 'Dune',
      country: 'AE',
      previousFingerprint: first ? `${offers[0]!.providerId}:${offers[0]!.availabilityType}:${offers[0]!.providerName}` : '',
      offers,
    })
    expect(same).toBeNull()
  })
})
