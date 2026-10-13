import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLibrary } from '@/app/LibraryProvider'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { VideoGrid } from '@/components/VideoGrid'

export function PlaylistDetailPage() {
  const { id = '' } = useParams()
  const { state, renamePlaylist, removeFromPlaylist } = useLibrary()
  const playlist = state.playlists.find((item) => item.id === id)
  const [name, setName] = useState(playlist?.name ?? '')

  if (!playlist) {
    return (
      <EmptyState
        title="Playlist missing"
        body="That list is not on this device."
        action={
          <Link to="/playlists">
            <Button variant="ghost">Back to playlists</Button>
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      <form
        className="flex max-w-xl gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          renamePlaylist(playlist.id, name)
        }}
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label="Rename playlist"
          className="flex-1 rounded-full border border-line bg-panel px-4 py-2.5"
        />
        <Button variant="primary" type="submit">
          Rename
        </Button>
      </form>
      {playlist.items.length === 0 ? (
        <EmptyState title="Empty list" body="Open a video and add it from the playlist button." />
      ) : (
        <>
          <VideoGrid videos={playlist.items} />
          <ul className="space-y-2 text-sm">
            {playlist.items.map((item) => (
              <li key={`${item.source}-${item.id}`} className="flex items-center justify-between">
                <span>
                  {item.title} · {item.source}
                </span>
                <Button onClick={() => removeFromPlaylist(playlist.id, item)}>Remove</Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
