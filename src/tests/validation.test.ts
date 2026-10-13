import { describe, expect, it } from 'vitest'
import {
  validateOwnedVideoId,
  validatePlaylistName,
  validateReleaseYear,
  validateSearchQuery,
  validateMovieId,
  validateTmdbMovieId,
  validateVideoLanguageCode,
  validateVideoSource,
  validateYoutubeVideoId,
} from '@/lib/validation'
import { extractYoutubeVideoId, searchOrWatchPath } from '@/lib/youtube'

describe('search query validation', () => {
  it('trims and accepts a normal query', () => {
    const result = validateSearchQuery('  blender open movie  ')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe('blender open movie')
  })

  it('rejects empty and oversized queries', () => {
    expect(validateSearchQuery('   ').ok).toBe(false)
    expect(validateSearchQuery('x'.repeat(501)).ok).toBe(false)
  })
})

describe('video id validation', () => {
  it('accepts canonical 11-character YouTube ids', () => {
    expect(validateYoutubeVideoId('aqz-KE-bpKQ').ok).toBe(true)
    expect(validateYoutubeVideoId('M7lc1UVf-VE').ok).toBe(true)
  })

  it('rejects malformed YouTube ids', () => {
    expect(validateYoutubeVideoId('short').ok).toBe(false)
    expect(validateYoutubeVideoId('not a valid!').ok).toBe(false)
    expect(validateYoutubeVideoId('../../../etc').ok).toBe(false)
  })

  it('accepts owned ids and sources', () => {
    expect(validateOwnedVideoId('big-buck-bunny').ok).toBe(true)
    expect(validateOwnedVideoId('Bad ID').ok).toBe(false)
    expect(validateVideoSource('youtube').ok).toBe(true)
    expect(validateVideoSource('cleanstream').ok).toBe(true)
    expect(validateVideoSource('torrent').ok).toBe(false)
  })

  it('accepts supported video languages', () => {
    expect(validateVideoLanguageCode('ml').ok).toBe(true)
    expect(validateVideoLanguageCode('ta').ok).toBe(true)
    expect(validateVideoLanguageCode('ar').ok).toBe(true)
    expect(validateVideoLanguageCode('xx').ok).toBe(false)
  })
})

describe('YouTube link parsing', () => {
  it('extracts ids from watch, short, and share URLs', () => {
    expect(extractYoutubeVideoId('aqz-KE-bpKQ')).toBe('aqz-KE-bpKQ')
    expect(extractYoutubeVideoId('https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=12s')).toBe('aqz-KE-bpKQ')
    expect(extractYoutubeVideoId('https://youtu.be/aqz-KE-bpKQ')).toBe('aqz-KE-bpKQ')
    expect(extractYoutubeVideoId('https://www.youtube.com/shorts/aqz-KE-bpKQ')).toBe('aqz-KE-bpKQ')
    expect(extractYoutubeVideoId('youtube.com/embed/aqz-KE-bpKQ')).toBe('aqz-KE-bpKQ')
    expect(extractYoutubeVideoId('https://example.com/watch?v=aqz-KE-bpKQ')).toBeNull()
    expect(extractYoutubeVideoId('independent')).toBeNull()
  })

  it('opens watch for links and search for titles', () => {
    expect(searchOrWatchPath('https://youtu.be/aqz-KE-bpKQ')).toBe('/watch/youtube/aqz-KE-bpKQ')
    expect(searchOrWatchPath('lofi hip hop')).toBe('/search?q=lofi%20hip%20hop')
    expect(searchOrWatchPath('independent')).toBe('/search?q=independent')
  })
})

describe('movie identifiers', () => {
  it('accepts TMDB ids and release years', () => {
    expect(validateTmdbMovieId('550').ok).toBe(true)
    expect(validateTmdbMovieId('0').ok).toBe(false)
    expect(validateMovieId('Q11424').ok).toBe(true)
    expect(validateMovieId('Q0').ok).toBe(false)
    expect(validateReleaseYear('1999').ok).toBe(true)
    expect(validateReleaseYear('1800').ok).toBe(false)
  })
})

describe('playlist names', () => {
  it('requires a non-empty name', () => {
    expect(validatePlaylistName('').ok).toBe(false)
    expect(validatePlaylistName(' Weekend list ').ok).toBe(true)
  })
})
