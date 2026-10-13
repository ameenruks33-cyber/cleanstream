import { describe, expect, it } from 'vitest'
import {
  addHistory,
  addToPlaylist,
  clearHistory,
  createEmptyLibrary,
  createPlaylist,
  deletePlaylist,
  isFavorite,
  renamePlaylist,
  toggleFavorite,
  updatePreferences,
} from '@/lib/userLibrary'
import { resolveAuthenticatedUserId } from '@/lib/authz'
import type { VideoRef } from '@/types'

const sample: VideoRef = {
  id: 'aqz-KE-bpKQ',
  source: 'youtube',
  title: 'Big Buck Bunny',
  channelTitle: 'Blender',
  thumbnailUrl: 'https://example.com/thumb.jpg',
}

describe('favorites', () => {
  it('adds and removes a favorite', () => {
    let state = createEmptyLibrary()
    state = toggleFavorite(state, sample)
    expect(isFavorite(state, sample)).toBe(true)
    state = toggleFavorite(state, sample)
    expect(isFavorite(state, sample)).toBe(false)
  })
})

describe('playlists', () => {
  it('creates, renames, and edits a playlist', () => {
    let state = createEmptyLibrary()
    state = createPlaylist(state, 'Later', 'pl-1')
    expect(state.playlists[0]?.name).toBe('Later')
    state = addToPlaylist(state, 'pl-1', sample)
    expect(state.playlists[0]?.items).toHaveLength(1)
    state = renamePlaylist(state, 'pl-1', 'Weekend')
    expect(state.playlists[0]?.name).toBe('Weekend')
    state = deletePlaylist(state, 'pl-1')
    expect(state.playlists).toHaveLength(0)
  })
})

describe('history', () => {
  it('records then clears history', () => {
    let state = createEmptyLibrary()
    state = addHistory(state, sample, 12)
    expect(state.history[0]?.progressSeconds).toBe(12)
    state = addHistory(state, sample, 40)
    expect(state.history).toHaveLength(1)
    state = clearHistory(state)
    expect(state.history).toHaveLength(0)
  })

  it('respects the history preference', () => {
    let state = updatePreferences(createEmptyLibrary(), { historyEnabled: false })
    state = addHistory(state, sample)
    expect(state.history).toHaveLength(0)
  })
})

describe('authorization', () => {
  it('ignores a client-supplied user id', () => {
    expect(resolveAuthenticatedUserId('user-a', 'user-b')).toBe('user-a')
    expect(() => resolveAuthenticatedUserId(null, 'user-b')).toThrow()
  })
})
