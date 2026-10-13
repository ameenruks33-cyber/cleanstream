import { Link } from 'react-router-dom'
import { useLibrary } from '@/app/LibraryProvider'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { VideoGrid } from '@/components/VideoGrid'
import { formatDate } from '@/lib/format'

export function HistoryPage() {
  const { state, clearHistory, updatePreferences } = useLibrary()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">History</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            History is stored locally for guests, and synced if you sign in. MyTube stores references, not media
            files.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => updatePreferences({ historyEnabled: !state.preferences.historyEnabled })}>
            {state.preferences.historyEnabled ? 'Pause history' : 'Resume history'}
          </Button>
          <Button variant="danger" onClick={clearHistory}>
            Clear history
          </Button>
        </div>
      </div>
      {state.history.length === 0 ? (
        <EmptyState
          title="Nothing watched yet"
          body="Titles you open will appear here if history is enabled."
          action={
            <Link to="/">
              <Button variant="ghost">Go home</Button>
            </Link>
          }
        />
      ) : (
        <>
          <p className="text-xs text-muted">Last watched {formatDate(state.history[0]?.watchedAt)}</p>
          <VideoGrid videos={state.history} />
        </>
      )}
    </div>
  )
}
