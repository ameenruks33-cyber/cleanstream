import { DEFAULT_WATCH_REGION, isWatchRegion } from '@/data/watchRegions'
import { deleteVaultRecord, readVaultRecord, writeVaultRecord } from '@/lib/cryptoVault'
import type { MovieNotification, MovieSummary } from '@/types/movies'

export const MOVIE_LIBRARY_KEY = 'mytube.movies.v1'

export type MovieWatchlistItem = Pick<MovieSummary, 'id' | 'title' | 'posterUrl' | 'year' | 'originalTitle'> & {
  country: string
  addedAt: string
}

export type MovieLibraryState = {
  country: string
  watchlist: MovieWatchlistItem[]
  searchHistory: string[]
  notifications: MovieNotification[]
  fingerprints: Record<string, string>
}

export function createEmptyMovieLibrary(): MovieLibraryState {
  return {
    country: DEFAULT_WATCH_REGION,
    watchlist: [],
    searchHistory: [],
    notifications: [],
    fingerprints: {},
  }
}

export function parseMovieLibrary(raw: string | null): MovieLibraryState {
  if (!raw) return createEmptyMovieLibrary()
  try {
    const parsed = JSON.parse(raw) as Partial<MovieLibraryState>
    const country = typeof parsed.country === 'string' && isWatchRegion(parsed.country) ? parsed.country : DEFAULT_WATCH_REGION
    return {
      country,
      watchlist: Array.isArray(parsed.watchlist) ? parsed.watchlist.filter(isWatchlistItem).slice(0, 100) : [],
      searchHistory: Array.isArray(parsed.searchHistory)
        ? parsed.searchHistory.filter((item): item is string => typeof item === 'string').slice(0, 20)
        : [],
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications.filter(isNotification).slice(0, 40) : [],
      fingerprints:
        parsed.fingerprints && typeof parsed.fingerprints === 'object' && !Array.isArray(parsed.fingerprints)
          ? Object.fromEntries(
              Object.entries(parsed.fingerprints).filter(
                (entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string',
              ),
            )
          : {},
    }
  } catch {
    return createEmptyMovieLibrary()
  }
}

function isWatchlistItem(value: unknown): value is MovieWatchlistItem {
  if (!value || typeof value !== 'object') return false
  const item = value as MovieWatchlistItem
  const id = typeof item.id === 'number' ? String(item.id) : item.id
  if (typeof id !== 'string' || !item.title || !item.addedAt) return false
  item.id = id
  return true
}

function isNotification(value: unknown): value is MovieNotification {
  if (!value || typeof value !== 'object') return false
  const item = value as MovieNotification
  if (typeof item.movieId === 'number') item.movieId = String(item.movieId)
  return typeof item.id === 'string' && typeof item.message === 'string' && typeof item.movieId === 'string'
}

export function toggleWatchlist(state: MovieLibraryState, movie: MovieWatchlistItem): MovieLibraryState {
  const exists = state.watchlist.some((item) => item.id === movie.id)
  return {
    ...state,
    watchlist: exists
      ? state.watchlist.filter((item) => item.id !== movie.id)
      : [{ ...movie, country: state.country, addedAt: movie.addedAt || new Date().toISOString() }, ...state.watchlist].slice(0, 100),
  }
}

export function isOnWatchlist(state: MovieLibraryState, id: string): boolean {
  return state.watchlist.some((item) => item.id === id)
}

export function recordMovieSearch(state: MovieLibraryState, query: string): MovieLibraryState {
  const value = query.trim()
  if (!value) return state
  return {
    ...state,
    searchHistory: [value, ...state.searchHistory.filter((item) => item !== value)].slice(0, 20),
  }
}

export function mergeNotifications(state: MovieLibraryState, incoming: MovieNotification[]): MovieLibraryState {
  if (incoming.length === 0) return state
  const seen = new Set(state.notifications.map((item) => item.id))
  const extra = incoming.filter((item) => !seen.has(item.id))
  return {
    ...state,
    notifications: [...extra, ...state.notifications].slice(0, 40),
  }
}

export async function loadMovieLibrary(): Promise<MovieLibraryState> {
  const raw = await readVaultRecord(MOVIE_LIBRARY_KEY)
  return parseMovieLibrary(raw)
}

export async function saveMovieLibrary(state: MovieLibraryState): Promise<void> {
  await writeVaultRecord(MOVIE_LIBRARY_KEY, JSON.stringify(state))
}

export async function clearMovieLibrary(): Promise<void> {
  await deleteVaultRecord(MOVIE_LIBRARY_KEY)
}
