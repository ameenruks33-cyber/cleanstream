import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLibrary } from '@/app/LibraryProvider'
import { CategoryChips } from '@/components/CategoryChips'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { VideoGrid } from '@/components/VideoGrid'
import { VideoGridSkeleton } from '@/components/Skeleton'
import { Button } from '@/components/Button'
import { BrandLogo, WaveLine, WaveName } from '@/components/Brand'
import { ownedVideos } from '@/data/ownedVideos'
import { fetchHealth, searchYoutube } from '@/services/api'
import type { YoutubeVideo } from '@/types'

export function HomePage() {
  const { state } = useLibrary()
  const [trending, setTrending] = useState<YoutubeVideo[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        await fetchHealth()
        const result = await searchYoutube('blender')
        if (cancelled) return
        setTrending(result.items)
        setNotice(result.quotaNotice ?? (result.mock ? 'Sample YouTube catalog' : null))
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load discovery.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-10">
      <section className="overflow-hidden rounded-[2rem] border border-line bg-panel p-6 md:p-10">
        <div className="flex flex-wrap items-center gap-5">
          <BrandLogo className="h-24 w-24 md:h-28 md:w-28" />
          <div>
            <WaveName as="h1" className="text-5xl md:text-7xl" />
            <WaveLine className="mt-2 w-40 md:w-56" />
          </div>
        </div>
      </section>

      <CategoryChips />

      {state.history.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-2xl">Continue</h2>
            <Link to="/history" className="text-sm text-muted hover:text-ink">
              History
            </Link>
          </div>
          <VideoGrid videos={state.history.slice(0, 8)} />
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl">Licensed on MyTube</h2>
          <Link to="/library" className="text-sm text-muted hover:text-ink">
            Full library
          </Link>
        </div>
        <VideoGrid videos={ownedVideos} />
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl">From YouTube</h2>
        {notice ? (
          <p className="rounded-2xl border border-line bg-raised px-4 py-3 text-sm text-muted">{notice}</p>
        ) : null}
        {loading ? <VideoGridSkeleton /> : null}
        {error ? <ErrorState body={error} onRetry={() => window.location.reload()} /> : null}
        {!loading && !error && trending.length === 0 ? (
          <EmptyState
            title="No YouTube results yet"
            body="Configure YOUTUBE_API_KEY on the server, or browse the MyTube library."
            action={
              <Link to="/library">
                <Button variant="ghost">Go to library</Button>
              </Link>
            }
          />
        ) : null}
        {!loading && trending.length > 0 ? <VideoGrid videos={trending} /> : null}
      </section>
    </div>
  )
}
