import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useLibrary } from '@/app/LibraryProvider'
import { CategoryChips } from '@/components/CategoryChips'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { VideoGrid } from '@/components/VideoGrid'
import { VideoGridSkeleton } from '@/components/Skeleton'
import { Button } from '@/components/Button'
import { validateSearchQuery } from '@/lib/validation'
import { extractYoutubeVideoId, youtubeWatchPath, youtubeWebsiteSearchUrl } from '@/lib/youtube'
import { searchYoutube } from '@/services/api'
import type { YoutubeVideo } from '@/types'

export function SearchPage() {
  const [params] = useSearchParams()
  const query = params.get('q') ?? ''
  const { recordSearch, state, clearSearchHistory } = useLibrary()
  const [items, setItems] = useState<YoutubeVideo[]>([])
  const [nextPage, setNextPage] = useState<string | undefined>()
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const directVideoId = extractYoutubeVideoId(query)

  useEffect(() => {
    if (directVideoId) return
    const parsed = validateSearchQuery(query)
    if (!parsed.ok) {
      setItems([])
      setError(query ? parsed.error : null)
      setLoading(false)
      return
    }
    const value = parsed.value
    recordSearch(value)
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      try {
        const result = await searchYoutube(value)
        if (cancelled) return
        setItems(result.items)
        setNextPage(result.nextPageToken)
        setNotice(result.quotaNotice ?? null)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Search failed.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [query, directVideoId])

  async function loadMore() {
    const parsed = validateSearchQuery(query)
    if (!parsed.ok || !nextPage) return
    const result = await searchYoutube(parsed.value, nextPage)
    setItems((current) => [...current, ...result.items])
    setNextPage(result.nextPageToken)
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Worldwide search</p>
        <h1 className="mt-2 font-display text-4xl">{query ? `Results for “${query}”` : 'Search any video'}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Search any title, topic, language, or channel in the world. Paste a YouTube link to play it immediately.
          Videos open in the official YouTube player.
        </p>
      </div>
      {directVideoId ? <Navigate to={youtubeWatchPath(directVideoId)} replace /> : null}
      <CategoryChips />

      {!query ? (
        <EmptyState
          title="Search any video in the world"
          body="Type what you want to watch and press Search. Or paste a youtube.com / youtu.be link."
        />
      ) : null}
      {state.searchHistory.length > 0 && !query ? (
        <div className="flex flex-wrap items-center gap-2">
          {state.searchHistory.map((item) => (
            <Link
              key={item}
              to={`/search?q=${encodeURIComponent(item)}`}
              className="rounded-full border border-line px-3 py-1 text-sm text-muted hover:text-ink"
            >
              {item}
            </Link>
          ))}
          <Button onClick={clearSearchHistory}>Clear searches</Button>
        </div>
      ) : null}
      {notice ? (
        <p className="rounded-2xl border border-line bg-raised px-4 py-3 text-sm text-muted">{notice}</p>
      ) : null}
      {loading ? <VideoGridSkeleton /> : null}
      {error ? <ErrorState body={error} /> : null}
      {!loading && query && items.length === 0 && !error ? (
        <EmptyState
          title="No matches"
          body="Try another search, or paste a YouTube link in the search bar."
        />
      ) : null}
      {!loading && query && items.length === 0 && !error ? (
        <p className="text-sm">
          <a className="text-tide" href={youtubeWebsiteSearchUrl(query)} target="_blank" rel="noreferrer">
            Open “{query}” on YouTube
          </a>
        </p>
      ) : null}
      {items.length > 0 ? <VideoGrid videos={items} /> : null}
      {nextPage ? (
        <div className="flex justify-center">
          <Button variant="ghost" onClick={() => void loadMore()}>
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  )
}
