import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useLibrary } from '@/app/LibraryProvider'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'

export function PlaylistsPage() {
  const { state, createPlaylist, deletePlaylist } = useLibrary()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  function onCreate(event: FormEvent) {
    event.preventDefault()
    try {
      createPlaylist(name)
      setName('')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create playlist.')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Playlists</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Playlists store video references (YouTube ids or CleanStream ids), not downloaded media.
        </p>
      </div>
      <form onSubmit={onCreate} className="flex max-w-xl flex-col gap-3 sm:flex-row">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Evening watchlist"
          aria-label="Playlist name"
          className="flex-1 rounded-full border border-line bg-panel px-4 py-2.5 text-sm"
        />
        <Button variant="primary" type="submit">
          Create playlist
        </Button>
      </form>
      {error ? <p className="text-sm text-ember">{error}</p> : null}
      {state.playlists.length === 0 ? (
        <EmptyState title="No playlists yet" body="Name a list and add titles from any watch page." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {state.playlists.map((playlist) => (
            <article key={playlist.id} className="rounded-3xl border border-line bg-panel p-5">
              <h2 className="font-display text-2xl">{playlist.name}</h2>
              <p className="mt-1 text-sm text-muted">
                {playlist.items.length} {playlist.items.length === 1 ? 'title' : 'titles'}
              </p>
              <div className="mt-4 flex gap-2">
                <Link to={`/playlists/${playlist.id}`}>
                  <Button variant="ghost">Open</Button>
                </Link>
                <Button variant="danger" onClick={() => deletePlaylist(playlist.id)}>
                  Delete
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
