import { describe, expect, it } from 'vitest'
import { detectTmdbLanguage } from '@/lib/queryLanguage'
import { normalizeTitle, titlesLikelyMatch, yearsLikelyMatch } from '@/lib/titleMatch'
import { matchOwnedLibrary, resolveInAppPlayback, searchOwnedLibrary } from '../../server/services/movies/authorizedLibrary.ts'

describe('title matching', () => {
  it('matches original titles, spelling-adjacent phrases, and Tamil script to a TMDB language', () => {
    expect(normalizeTitle('The Sintel')).toBe('sintel')
    expect(titlesLikelyMatch('Sintel', 'sintel')).toBe(true)
    expect(titlesLikelyMatch('Thani Oruvan', 'Sintel')).toBe(false)
    expect(yearsLikelyMatch(2010, 2010)).toBe(true)
    expect(detectTmdbLanguage('தனி ஒருவன்')).toBe('ta-IN')
    expect(detectTmdbLanguage('Interstellar')).toBeUndefined()
  })
})

describe('authorized library playback', () => {
  it('treats licensed library files as in-app movies and storefronts as not playable here', () => {
    expect(searchOwnedLibrary('sintel')[0]?.videoId).toBe('sintel')
    expect(matchOwnedLibrary('Sintel', 'Sintel', 2010)?.videoId).toBe('sintel')
    expect(resolveInAppPlayback({ title: 'Sintel', year: 2010, trailerYoutubeId: 'abcdefghijk' })).toEqual({
      kind: 'owned-file',
      videoId: 'sintel',
      title: 'Sintel',
    })
    expect(resolveInAppPlayback({ title: 'Thani Oruvan', trailerYoutubeId: 'abcdefghijk' })).toEqual({
      kind: 'youtube-trailer',
      videoId: 'abcdefghijk',
    })
    expect(resolveInAppPlayback({ title: 'Unknown Title' })).toEqual({ kind: 'none' })
  })
})
