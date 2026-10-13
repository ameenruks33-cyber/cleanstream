import { Link } from 'react-router-dom'
import { useLibrary } from '@/app/LibraryProvider'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { VideoGrid } from '@/components/VideoGrid'

export function FavoritesPage() {
  const { state } = useLibrary()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Favorites</h1>
        <p className="mt-2 text-sm text-muted">Saved references only. Nothing is downloaded from YouTube.</p>
      </div>
      {state.favorites.length === 0 ? (
        <EmptyState
          title="No favorites"
          body="Tap the heart on a watch page to keep a title here."
          action={
            <Link to="/library">
              <Button variant="ghost">Browse library</Button>
            </Link>
          }
        />
      ) : (
        <VideoGrid videos={state.favorites} />
      )}
    </div>
  )
}
