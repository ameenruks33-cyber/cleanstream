import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  createEmptyMovieLibrary,
  isOnWatchlist as checkWatchlist,
  loadMovieLibrary,
  mergeNotifications,
  recordMovieSearch,
  saveMovieLibrary,
  toggleWatchlist,
  type MovieLibraryState,
  type MovieWatchlistItem,
} from '@/lib/movieLibrary'
import type { MovieNotification } from '@/types/movies'
import { isWatchRegion } from '@/data/watchRegions'

type MovieLibraryContextValue = {
  state: MovieLibraryState
  ready: boolean
  setCountry: (country: string) => void
  toggleWatchlist: (movie: MovieWatchlistItem) => void
  isOnWatchlist: (id: string) => boolean
  recordSearch: (query: string) => void
  clearSearchHistory: () => void
  applyRefresh: (fingerprints: Record<string, string>, notifications: MovieNotification[]) => void
  dismissNotifications: () => void
}

const MovieLibraryContext = createContext<MovieLibraryContextValue | null>(null)

export function MovieLibraryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MovieLibraryState>(createEmptyMovieLibrary)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void loadMovieLibrary()
      .then((loaded) => {
        if (!cancelled) setState(loaded)
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    void saveMovieLibrary(state)
  }, [ready, state])

  const setCountry = useCallback((country: string) => {
    if (!isWatchRegion(country)) return
    setState((current) => ({ ...current, country }))
  }, [])

  const toggle = useCallback((movie: MovieWatchlistItem) => {
    setState((current) => toggleWatchlist(current, movie))
  }, [])

  const recordSearch = useCallback((query: string) => {
    setState((current) => recordMovieSearch(current, query))
  }, [])

  const applyRefresh = useCallback((fingerprints: Record<string, string>, notifications: MovieNotification[]) => {
    setState((current) =>
      mergeNotifications(
        {
          ...current,
          fingerprints: { ...current.fingerprints, ...fingerprints },
        },
        notifications,
      ),
    )
  }, [])

  const value = useMemo<MovieLibraryContextValue>(
    () => ({
      state,
      ready,
      setCountry,
      toggleWatchlist: toggle,
      isOnWatchlist: (id: string) => checkWatchlist(state, id),
      recordSearch,
      clearSearchHistory: () => setState((current) => ({ ...current, searchHistory: [] })),
      applyRefresh,
      dismissNotifications: () => setState((current) => ({ ...current, notifications: [] })),
    }),
    [applyRefresh, ready, recordSearch, setCountry, state, toggle],
  )

  return <MovieLibraryContext.Provider value={value}>{children}</MovieLibraryContext.Provider>
}

export function useMovieLibrary() {
  const value = useContext(MovieLibraryContext)
  if (!value) throw new Error('useMovieLibrary must be used inside MovieLibraryProvider')
  return value
}
