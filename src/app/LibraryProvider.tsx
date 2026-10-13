import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { LibraryState, Playlist, Preferences, VideoRef } from '@/types'
import {
  LIBRARY_STORAGE_KEY,
  addHistory,
  addToPlaylist,
  clearHistory,
  clearSearchHistory,
  createEmptyLibrary,
  createPlaylist,
  deletePlaylist,
  isFavorite as checkFavorite,
  parseLibrary,
  recordSearch,
  removeFromPlaylist,
  renamePlaylist,
  serializeLibrary,
  toggleFavorite,
  updatePreferences,
} from '@/lib/userLibrary'
import { supabase } from '@/services/supabaseClient'
import { deleteRemoteLibrary, mergeAndSync, pushRemoteLibrary } from '@/services/sync'
import { clearAdShieldStore } from '@/lib/adshield/storage'

type LibraryContextValue = {
  state: LibraryState
  user: User | null
  session: Session | null
  ready: boolean
  toggleFavorite: (video: VideoRef) => void
  isFavorite: (video: Pick<VideoRef, 'source' | 'id'>) => boolean
  addToHistory: (video: VideoRef, progressSeconds?: number) => void
  clearHistory: () => void
  recordSearch: (query: string) => void
  clearSearchHistory: () => void
  createPlaylist: (name: string) => Playlist | null
  renamePlaylist: (id: string, name: string) => void
  deletePlaylist: (id: string) => void
  addToPlaylist: (playlistId: string, video: VideoRef) => void
  removeFromPlaylist: (playlistId: string, video: Pick<VideoRef, 'source' | 'id'>) => void
  updatePreferences: (patch: Partial<Preferences>) => void
  signIn: (email: string) => Promise<string>
  signOut: () => Promise<void>
  deleteAccountData: () => Promise<void>
}

const LibraryContext = createContext<LibraryContextValue | null>(null)

function loadLocal(): LibraryState {
  if (typeof window === 'undefined') return createEmptyLibrary()
  return parseLibrary(window.localStorage.getItem(LIBRARY_STORAGE_KEY))
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LibraryState>(loadLocal)
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    window.localStorage.setItem(LIBRARY_STORAGE_KEY, serializeLibrary(state))
  }, [state])

  useEffect(() => {
    if (!supabase) {
      setReady(true)
      return
    }
    let cancelled = false
    void supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return
      setSession(data.session)
      setUser(data.session?.user ?? null)
      if (data.session?.user) {
        const merged = await mergeAndSync(data.session.user.id, loadLocal())
        if (!cancelled) setState(merged)
      }
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      if (nextSession?.user) {
        void mergeAndSync(nextSession.user.id, loadLocal()).then(setState)
      }
    })
    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!user || !ready) return
    const handle = window.setTimeout(() => {
      void pushRemoteLibrary(user.id, state)
    }, 800)
    return () => window.clearTimeout(handle)
  }, [state, user, ready])

  const createPlaylistAction = useCallback((name: string) => {
    let created: Playlist | null = null
    setState((current) => {
      const next = createPlaylist(current, name)
      created = next.playlists[0] ?? null
      return next
    })
    return created
  }, [])

  const value = useMemo<LibraryContextValue>(
    () => ({
      state,
      user,
      session,
      ready,
      toggleFavorite: (video) => setState((current) => toggleFavorite(current, video)),
      isFavorite: (video) => checkFavorite(state, video),
      addToHistory: (video, progressSeconds) => setState((current) => addHistory(current, video, progressSeconds)),
      clearHistory: () => setState((current) => clearHistory(current)),
      recordSearch: (query) => setState((current) => recordSearch(current, query)),
      clearSearchHistory: () => setState((current) => clearSearchHistory(current)),
      createPlaylist: createPlaylistAction,
      renamePlaylist: (id, name) => setState((current) => renamePlaylist(current, id, name)),
      deletePlaylist: (id) => setState((current) => deletePlaylist(current, id)),
      addToPlaylist: (playlistId, video) => setState((current) => addToPlaylist(current, playlistId, video)),
      removeFromPlaylist: (playlistId, video) =>
        setState((current) => removeFromPlaylist(current, playlistId, video)),
      updatePreferences: (patch) => setState((current) => updatePreferences(current, patch)),
      signIn: async (email: string) => {
        if (!supabase) {
          throw new Error('Supabase is not configured. Guest mode keeps data on this device.')
        }
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin },
        })
        if (error) throw error
        return 'Check your email for a sign-in link.'
      },
      signOut: async () => {
        if (supabase) await supabase.auth.signOut()
        setUser(null)
        setSession(null)
      },
      deleteAccountData: async () => {
        if (user) await deleteRemoteLibrary(user.id)
        if (supabase) await supabase.auth.signOut()
        window.localStorage.removeItem(LIBRARY_STORAGE_KEY)
        clearAdShieldStore()
        setState(createEmptyLibrary())
        setUser(null)
        setSession(null)
      },
    }),
    [state, user, session, ready, createPlaylistAction],
  )

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}

export function useLibrary(): LibraryContextValue {
  const context = useContext(LibraryContext)
  if (!context) {
    throw new Error('useLibrary must be used inside LibraryProvider')
  }
  return context
}
