import type { HistoryItem, LibraryState, Playlist, Preferences, VideoRef } from '@/types'
import { validatePlaylistName } from '@/lib/validation'

export const LIBRARY_STORAGE_KEY = 'cleanstream.library.v1'

export const defaultPreferences: Preferences = {
  theme: 'dark',
  reducedMotion: false,
  analyticsConsent: false,
  historyEnabled: true,
}

export function createEmptyLibrary(): LibraryState {
  return {
    favorites: [],
    playlists: [],
    history: [],
    searchHistory: [],
    preferences: { ...defaultPreferences },
  }
}

export function videoKey(video: Pick<VideoRef, 'source' | 'id'>): string {
  return `${video.source}:${video.id}`
}

export function sameVideo(a: Pick<VideoRef, 'source' | 'id'>, b: Pick<VideoRef, 'source' | 'id'>): boolean {
  return a.source === b.source && a.id === b.id
}

export function toggleFavorite(state: LibraryState, video: VideoRef): LibraryState {
  const exists = state.favorites.some((item) => sameVideo(item, video))
  return {
    ...state,
    favorites: exists
      ? state.favorites.filter((item) => !sameVideo(item, video))
      : [{ ...video }, ...state.favorites],
  }
}

export function isFavorite(state: LibraryState, video: Pick<VideoRef, 'source' | 'id'>): boolean {
  return state.favorites.some((item) => sameVideo(item, video))
}

export function addHistory(
  state: LibraryState,
  video: VideoRef,
  progressSeconds = 0,
  at = new Date().toISOString(),
): LibraryState {
  if (!state.preferences.historyEnabled) return state
  const nextItem: HistoryItem = {
    ...video,
    watchedAt: at,
    progressSeconds,
  }
  return {
    ...state,
    history: [nextItem, ...state.history.filter((item) => !sameVideo(item, video))].slice(0, 200),
  }
}

export function clearHistory(state: LibraryState): LibraryState {
  return { ...state, history: [] }
}

export function recordSearch(state: LibraryState, query: string): LibraryState {
  const value = query.trim()
  if (!value) return state
  return {
    ...state,
    searchHistory: [value, ...state.searchHistory.filter((item) => item.toLowerCase() !== value.toLowerCase())].slice(
      0,
      20,
    ),
  }
}

export function clearSearchHistory(state: LibraryState): LibraryState {
  return { ...state, searchHistory: [] }
}

export function createPlaylist(state: LibraryState, name: string, id = crypto.randomUUID()): LibraryState {
  const parsed = validatePlaylistName(name)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }
  const now = new Date().toISOString()
  const playlist: Playlist = {
    id,
    name: parsed.value,
    description: '',
    createdAt: now,
    updatedAt: now,
    items: [],
  }
  return { ...state, playlists: [playlist, ...state.playlists] }
}

export function renamePlaylist(state: LibraryState, playlistId: string, name: string): LibraryState {
  const parsed = validatePlaylistName(name)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }
  return {
    ...state,
    playlists: state.playlists.map((playlist) =>
      playlist.id === playlistId
        ? { ...playlist, name: parsed.value, updatedAt: new Date().toISOString() }
        : playlist,
    ),
  }
}

export function deletePlaylist(state: LibraryState, playlistId: string): LibraryState {
  return {
    ...state,
    playlists: state.playlists.filter((playlist) => playlist.id !== playlistId),
  }
}

export function addToPlaylist(state: LibraryState, playlistId: string, video: VideoRef): LibraryState {
  return {
    ...state,
    playlists: state.playlists.map((playlist) => {
      if (playlist.id !== playlistId) return playlist
      if (playlist.items.some((item) => sameVideo(item, video))) return playlist
      return {
        ...playlist,
        items: [...playlist.items, { ...video }],
        updatedAt: new Date().toISOString(),
      }
    }),
  }
}

export function removeFromPlaylist(
  state: LibraryState,
  playlistId: string,
  video: Pick<VideoRef, 'source' | 'id'>,
): LibraryState {
  return {
    ...state,
    playlists: state.playlists.map((playlist) =>
      playlist.id === playlistId
        ? {
            ...playlist,
            items: playlist.items.filter((item) => !sameVideo(item, video)),
            updatedAt: new Date().toISOString(),
          }
        : playlist,
    ),
  }
}

export function updatePreferences(state: LibraryState, patch: Partial<Preferences>): LibraryState {
  return {
    ...state,
    preferences: { ...state.preferences, ...patch },
  }
}

export function serializeLibrary(state: LibraryState): string {
  return JSON.stringify(state)
}

export function parseLibrary(raw: string | null): LibraryState {
  if (!raw) return createEmptyLibrary()
  try {
    const parsed = JSON.parse(raw) as Partial<LibraryState>
    const empty = createEmptyLibrary()
    return {
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : empty.favorites,
      playlists: Array.isArray(parsed.playlists) ? parsed.playlists : empty.playlists,
      history: Array.isArray(parsed.history) ? parsed.history : empty.history,
      searchHistory: Array.isArray(parsed.searchHistory) ? parsed.searchHistory : empty.searchHistory,
      preferences: { ...empty.preferences, ...(parsed.preferences ?? {}) },
    }
  } catch {
    return createEmptyLibrary()
  }
}

export function mergeLibraries(local: LibraryState, remote: LibraryState): LibraryState {
  const favMap = new Map<string, VideoRef>()
  for (const item of [...remote.favorites, ...local.favorites]) {
    favMap.set(videoKey(item), item)
  }
  const playlistMap = new Map<string, Playlist>()
  for (const playlist of [...remote.playlists, ...local.playlists]) {
    const existing = playlistMap.get(playlist.id)
    if (!existing || playlist.updatedAt > existing.updatedAt) {
      playlistMap.set(playlist.id, playlist)
    }
  }
  const historyMap = new Map<string, HistoryItem>()
  for (const item of [...remote.history, ...local.history]) {
    const key = videoKey(item)
    const existing = historyMap.get(key)
    if (!existing || item.watchedAt > existing.watchedAt) {
      historyMap.set(key, item)
    }
  }
  return {
    favorites: [...favMap.values()],
    playlists: [...playlistMap.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    history: [...historyMap.values()].sort((a, b) => b.watchedAt.localeCompare(a.watchedAt)).slice(0, 200),
    searchHistory: [...new Set([...local.searchHistory, ...remote.searchHistory])].slice(0, 20),
    preferences: { ...remote.preferences, ...local.preferences },
  }
}
