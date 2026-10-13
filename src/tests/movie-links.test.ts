import { describe, expect, it } from 'vitest'
import { isOfficialWatchLink, justWatchSearchUrl, sanitizeOfficialWatchLink } from '@/lib/movieLinks'
import { isWatchRegion, DEFAULT_WATCH_REGION } from '@/data/watchRegions'
import { validateMovieId, validateReleaseYear, validateTmdbMovieId } from '@/lib/validation'
import { parseMovieLibrary, toggleWatchlist, createEmptyMovieLibrary } from '@/lib/movieLibrary'

describe('official playback links', () => {
  it('allows HTTPS JustWatch and TMDB hosts only', () => {
    expect(isOfficialWatchLink('https://www.justwatch.com/ae/movie/dune')).toBe(true)
    expect(isOfficialWatchLink('https://themoviedb.org/movie/438631')).toBe(true)
    expect(isOfficialWatchLink('http://www.justwatch.com/ae/movie/dune')).toBe(false)
    expect(isOfficialWatchLink('https://pirate.example/full-movie.mp4')).toBe(false)
    expect(isOfficialWatchLink('https://t.me/piracybot')).toBe(false)
    expect(isOfficialWatchLink('https://127.0.0.1/movie')).toBe(false)
    expect(sanitizeOfficialWatchLink('https://user:pass@www.justwatch.com/ae')).toBeUndefined()
    expect(justWatchSearchUrl('AE', 'Dune')).toBe('https://www.justwatch.com/ae/search?q=Dune')
  })
})

describe('movie identifiers and regions', () => {
  it('defaults to the UAE and validates TMDB ids', () => {
    expect(DEFAULT_WATCH_REGION).toBe('AE')
    expect(isWatchRegion('AE')).toBe(true)
    expect(isWatchRegion('XX')).toBe(false)
    expect(validateTmdbMovieId('438631').ok).toBe(true)
    expect(validateTmdbMovieId('nope').ok).toBe(false)
    expect(validateMovieId('Q72932').ok).toBe(true)
    expect(validateMovieId('438631').ok).toBe(true)
    expect(validateReleaseYear('2021').ok).toBe(true)
    expect(validateReleaseYear('12').ok).toBe(false)
  })
})

describe('movie watchlist', () => {
  it('toggles titles without storing extra personal data', () => {
    const movie = {
      id: 'Q72932',
      title: 'Dune',
      originalTitle: 'Dune',
      posterUrl: 'https://image.tmdb.org/t/p/w500/dune.jpg',
      year: 2021,
      country: 'AE',
      addedAt: '2026-01-01T00:00:00.000Z',
    }
    const added = toggleWatchlist(createEmptyMovieLibrary(), movie)
    expect(added.watchlist).toHaveLength(1)
    const removed = toggleWatchlist(added, movie)
    expect(removed.watchlist).toHaveLength(0)
    expect(parseMovieLibrary('not-json').country).toBe('AE')
  })
})
