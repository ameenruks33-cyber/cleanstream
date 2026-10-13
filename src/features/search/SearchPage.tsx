import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useLibrary } from '@/app/LibraryProvider'
import { useMovieLibrary } from '@/app/MovieLibraryProvider'
import { CategoryChips } from '@/components/CategoryChips'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { VideoGrid } from '@/components/VideoGrid'
import { VideoGridSkeleton } from '@/components/Skeleton'
import { Button } from '@/components/Button'
import { MovieGrid, MovieGridSkeleton } from '@/features/movies/MovieCard'
import { validateSearchQuery } from '@/lib/validation'
import { extractYoutubeVideoId, youtubeWatchPath, youtubeWebsiteSearchUrl } from '@/lib/youtube'
import { searchMovies, searchYoutube } from '@/services/api'
import type { YoutubeVideo } from '@/types'
import type { AuthorizedLibraryMatch, MovieSummary } from '@/types/movies'

export function SearchPage() {
  const [params] = useSearchParams()
  const query = params.get('q') ?? ''
  const { recordSearch, state, clearSearchHistory } = useLibrary()
  const { state: movies } = useMovieLibrary()
  const [items, setItems] = useState<YoutubeVideo[]>([])
  const [movieItems, setMovieItems] = useState<MovieSummary[]>([])
  const [libraryMatches, setLibraryMatches] = useState<AuthorizedLibraryMatch[]>([])
  const [nextPage, setNextPage] = useState<string | undefined>()
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [movieError, setMovieError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const directVideoId = extractYoutubeVideoId(query)

  useEffect(() => {
    if (directVideoId) return
    const parsed = validateSearchQuery(query)
    if (!parsed.ok) {
      setItems([])
      setMovieItems([])
      setLibraryMatches([])
      setError(query ? parsed.error : null)
      setMovieError(null)
      setLoading(false)
      return
    }
    const value = parsed.value
    recordSearch(value)
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      setMovieError(null)
      const [videos, titles] = await Promise.allSettled([
        searchYoutube(value),
        searchMovies({ query: value, country: movies.country }),
      ])
      if (cancelled) return
      if (videos.status === 'fulfilled') {
        setItems(videos.value.items)
        setNextPage(videos.value.nextPageToken)
        setNotice(videos.value.quotaNotice ?? null)
      } else {
        setItems([])
        setNextPage(undefined)
        setError(videos.reason instanceof Error ? videos.reason.message : 'Video search failed.')
      }
      if (titles.status === 'fulfilled') {
        setMovieItems(titles.value.items)
        setLibraryMatches(titles.value.libraryMatches ?? [])
      } else {
        setMovieItems([])
        setLibraryMatches([])
        setMovieError(titles.reason instanceof Error ? titles.reason.message : 'Movie search failed.')
      }
      setLoading(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [query, directVideoId, movies.country])

  async function loadMore() {
    const parsed = validateSearchQuery(query)
    if (!parsed.ok || !nextPage) return
    const result = await searchYoutube(parsed.value, nextPage)
    setItems((current) => [...current, ...result.items])
    setNextPage(result.nextPageToken)
  }

  const noResults = !loading && query && items.length === 0 && movieItems.length === 0 && libraryMatches.length === 0

  return (
    <div className="space-y-6">
      {query ? (
        <h1 className="font-display text-4xl">Results for “{query}”</h1>
      ) : null}
      {directVideoId ? <Navigate to={youtubeWatchPath(directVideoId)} replace /> : null}
      <CategoryChips />
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

      {loading ? (
        <div className="space-y-6">
          <MovieGridSkeleton count={5} />
          <VideoGridSkeleton />
        </div>
      ) : null}

      {!loading && libraryMatches.length ? (
        <section className="space-y-3">
          <h2 className="font-display text-2xl">Play here</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {libraryMatches.map((item) => (
              <Link key={item.videoId} to={`/watch/cleanstream/${item.videoId}`} className="w-28 shrink-0">
                <div className="aspect-[2/3] overflow-hidden rounded-xl bg-raised">
                  {item.posterUrl ? <img src={item.posterUrl} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <p className="mt-2 line-clamp-2 text-xs">{item.title}</p>
                <p className="text-[10px] text-tide">Play here</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {!loading && movieItems.length ? (
        <section className="space-y-3">
          <h2 className="font-display text-2xl">Movies</h2>
          <MovieGrid movies={movieItems} country={movies.country} />
        </section>
      ) : null}
      {movieError ? <ErrorState body={movieError} /> : null}

      {!loading && items.length ? (
        <section className="space-y-3">
          <h2 className="font-display text-2xl">Videos</h2>
          <VideoGrid videos={items} />
        </section>
      ) : null}
      {error ? <ErrorState body={error} /> : null}

      {noResults && !error && !movieError ? (
        <EmptyState title="No matches" body="Try another search, or paste a YouTube link in the search bar." />
      ) : null}
      {noResults && !error ? (
        <p className="text-sm">
          <a className="text-tide" href={youtubeWebsiteSearchUrl(query)} target="_blank" rel="noreferrer">
            Open “{query}” on YouTube
          </a>
        </p>
      ) : null}
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
