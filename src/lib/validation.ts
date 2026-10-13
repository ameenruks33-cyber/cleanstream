import type { VideoSource } from '@/types'
import { VIDEO_LANGUAGE_CODES, type VideoLanguageCode } from './videoLanguages.ts'

export const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/
export const SEARCH_QUERY_MAX = 500
export const PLAYLIST_NAME_MAX = 80

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; code: string }

export function validateSearchQuery(raw: string): ValidationResult<string> {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Search query must be text.', code: 'INVALID_QUERY' }
  }
  const query = raw.trim().replace(/\s+/g, ' ')
  if (query.length < 1) {
    return { ok: false, error: 'Enter a search term.', code: 'EMPTY_QUERY' }
  }
  if (query.length > SEARCH_QUERY_MAX) {
    return {
      ok: false,
      error: `Search is limited to ${SEARCH_QUERY_MAX} characters.`,
      code: 'QUERY_TOO_LONG',
    }
  }
  return { ok: true, value: query }
}

export function validateYoutubeVideoId(raw: string): ValidationResult<string> {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Video id must be text.', code: 'INVALID_VIDEO_ID' }
  }
  const id = raw.trim()
  if (!YOUTUBE_ID_RE.test(id)) {
    return {
      ok: false,
      error: 'That does not look like a valid YouTube video id.',
      code: 'INVALID_VIDEO_ID',
    }
  }
  return { ok: true, value: id }
}

export function validatePlaylistName(raw: string): ValidationResult<string> {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Playlist name must be text.', code: 'INVALID_NAME' }
  }
  const name = raw.trim().replace(/\s+/g, ' ')
  if (name.length < 1) {
    return { ok: false, error: 'Give this playlist a name.', code: 'EMPTY_NAME' }
  }
  if (name.length > PLAYLIST_NAME_MAX) {
    return {
      ok: false,
      error: `Names are limited to ${PLAYLIST_NAME_MAX} characters.`,
      code: 'NAME_TOO_LONG',
    }
  }
  return { ok: true, value: name }
}

export function validateVideoSource(raw: string): ValidationResult<VideoSource> {
  if (raw === 'youtube' || raw === 'cleanstream') {
    return { ok: true, value: raw }
  }
  return { ok: false, error: 'Unknown video source.', code: 'INVALID_SOURCE' }
}

export function validateTmdbMovieId(raw: string | number): ValidationResult<number> {
  const id = Number(String(raw).trim())
  if (!Number.isInteger(id) || id < 1 || id > 99_999_999) {
    return { ok: false, error: 'That movie id is not valid.', code: 'INVALID_MOVIE_ID' }
  }
  return { ok: true, value: id }
}

export function validateMovieId(raw: string): ValidationResult<string> {
  const id = raw.trim()
  if (/^Q[1-9]\d{0,11}$/.test(id)) return { ok: true, value: id }
  const numeric = validateTmdbMovieId(id)
  if (numeric.ok) return { ok: true, value: String(numeric.value) }
  return { ok: false, error: 'That movie id is not valid.', code: 'INVALID_MOVIE_ID' }
}

export function validateReleaseYear(raw: string): ValidationResult<number> {
  const year = Number(String(raw).trim())
  if (!Number.isInteger(year) || year < 1870 || year > 2100) {
    return { ok: false, error: 'Year is not valid.', code: 'INVALID_YEAR' }
  }
  return { ok: true, value: year }
}

export function validateLanguageCode(raw: string): ValidationResult<string> {
  const value = raw.trim().toLowerCase()
  if (!/^[a-z]{2}(?:-[A-Z]{2})?$/i.test(value) || value.length > 5) {
    return { ok: false, error: 'Language code is not valid.', code: 'INVALID_LANGUAGE' }
  }
  return { ok: true, value: value.slice(0, 2) }
}

export function validateVideoLanguageCode(raw: string): ValidationResult<VideoLanguageCode> {
  const value = raw.trim().toLowerCase()
  if ((VIDEO_LANGUAGE_CODES as string[]).includes(value)) {
    return { ok: true, value: value as VideoLanguageCode }
  }
  return { ok: false, error: 'That language is not supported.', code: 'INVALID_LANGUAGE' }
}

export function validateOwnedVideoId(raw: string): ValidationResult<string> {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Video id must be text.', code: 'INVALID_VIDEO_ID' }
  }
  const id = raw.trim()
  if (!/^[a-z0-9-]{3,64}$/.test(id)) {
    return { ok: false, error: 'That MyTube video id is not valid.', code: 'INVALID_VIDEO_ID' }
  }
  return { ok: true, value: id }
}
