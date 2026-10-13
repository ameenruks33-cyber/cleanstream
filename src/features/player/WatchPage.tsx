import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Heart, ListPlus } from 'lucide-react'
import { useLibrary } from '@/app/LibraryProvider'
import { Button } from '@/components/Button'
import { ErrorState } from '@/components/ErrorState'
import { SourceBadge } from '@/components/SourceBadge'
import { VideoGridSkeleton } from '@/components/Skeleton'
import { Modal } from '@/components/Modal'
import { YouTubeEmbed } from '@/features/player/YouTubeEmbed'
import { Html5Player } from '@/features/player/Html5Player'
import { WatchNav } from '@/features/player/WatchNav'
import { formatCompactNumber, formatDate, formatDuration } from '@/lib/format'
import { validateOwnedVideoId, validateVideoSource, validateYoutubeVideoId } from '@/lib/validation'
import { enhancedMediaUrl, fetchEnhanceJob, fetchOwnedVideo, fetchYoutubeVideo, inspectVideoQuality, queueEnhancement } from '@/services/api'
import { EnhanceStatus } from '@/features/player/EnhanceStatus'
import { ownedVideos } from '@/data/ownedVideos'
import {
  ensureCurrentInQueue,
  neighborsInQueue,
  readWatchQueue,
  videoKey,
  watchPath,
  type WatchQueue,
  type WatchQueueItem,
} from '@/lib/watchQueue'
import { useImmersive } from '@/app/ImmersiveProvider'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { shouldAutoEnterFullView, shouldAutoExitFullView } from '@/lib/displayMode'
import type { EnhanceJob, OwnedVideo, QualityInspection, VideoRef, YoutubeVideo } from '@/types'

export function WatchPage() {
  const { source = '', id = '' } = useParams()
  const navigate = useNavigate()
  const library = useLibrary()
  const immersive = useImmersive()
  const handheld = useMediaQuery('(pointer: coarse)')
  const landscape = useMediaQuery('(orientation: landscape)')
  const playerBox = useRef<HTMLDivElement>(null)
  const autoEntered = useRef(false)
  const skipAuto = useRef(false)
  const [youtube, setYoutube] = useState<YoutubeVideo | null>(null)
  const [owned, setOwned] = useState<OwnedVideo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [playlistOpen, setPlaylistOpen] = useState(false)
  const [newPlaylist, setNewPlaylist] = useState('')
  const [inspection, setInspection] = useState<QualityInspection | null>(null)
  const [job, setJob] = useState<EnhanceJob | null>(null)
  const [usingEnhanced, setUsingEnhanced] = useState(false)
  const [queue, setQueue] = useState<WatchQueue>(() => readWatchQueue())

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      setYoutube(null)
      setOwned(null)
      const sourceResult = validateVideoSource(source)
      if (!sourceResult.ok) {
        setError(sourceResult.error)
        setLoading(false)
        return
      }
      try {
        if (sourceResult.value === 'youtube') {
          const parsed = validateYoutubeVideoId(id)
          if (!parsed.ok) throw new Error(parsed.error)
          const video = await fetchYoutubeVideo(parsed.value)
          if (!cancelled) setYoutube(video)
        } else {
          const parsed = validateOwnedVideoId(id)
          if (!parsed.ok) throw new Error(parsed.error)
          const video = await fetchOwnedVideo(parsed.value)
          if (!cancelled) setOwned(video)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Video unavailable.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id, source])

  useEffect(() => {
    let cancelled = false
    async function inspect() {
      setInspection(null)
      setJob(null)
      setUsingEnhanced(false)
      const sourceResult = validateVideoSource(source)
      if (!sourceResult.ok) return
      try {
        const report = await inspectVideoQuality(sourceResult.value, id)
        if (cancelled) return
        setInspection(report)
        if (sourceResult.value === 'cleanstream' && report.enhanceable) {
          const queued = await queueEnhancement(id)
          if (!cancelled) setJob(queued)
        }
      } catch {
        if (!cancelled) {
          setInspection({
            enhanceable: false,
            reason: 'Playing the original. Enhancement is unavailable for this title.',
          })
        }
      }
    }
    void inspect()
    return () => {
      cancelled = true
    }
  }, [id, source])

  useEffect(() => {
    if (!job?.jobId) return
    if (job.status === 'ready' || job.status === 'failed' || job.status === 'skipped') return
    const jobId = job.jobId
    const timer = window.setInterval(() => {
      void fetchEnhanceJob(jobId).then((next) => {
        setJob(next)
        if (next.status === 'ready' && next.outputId) setUsingEnhanced(true)
      })
    }, 2000)
    return () => window.clearInterval(timer)
  }, [job?.jobId, job?.status])

  const video: VideoRef | null = youtube ?? owned
  const staleVideo = Boolean(video && (video.id !== id || video.source !== source))
  const favorite = video && !staleVideo ? library.isFavorite(video) : false
  const { previous, next, index } = neighborsInQueue(queue.items, source, id)
  const upcoming = index >= 0 ? queue.items.slice(index + 1, index + 8) : queue.items.slice(0, 8)

  function goBack() {
    if (immersive.active) void immersive.exit()
    navigate(queue.origin || '/')
  }

  function goTo(item: WatchQueueItem) {
    navigate(watchPath(item))
  }

  async function toggleFullView() {
    if (immersive.active) {
      skipAuto.current = true
      autoEntered.current = false
      await immersive.exit()
      return
    }
    skipAuto.current = false
    await immersive.enter(playerBox.current)
  }

  useEffect(() => {
    if (
      shouldAutoEnterFullView({
        handheld,
        landscape,
        active: immersive.active,
        skipped: skipAuto.current,
      })
    ) {
      autoEntered.current = true
      void immersive.enter(playerBox.current)
      return
    }
    if (shouldAutoExitFullView({ handheld, landscape, autoEntered: autoEntered.current })) {
      autoEntered.current = false
      skipAuto.current = false
      void immersive.exit()
    }
    if (!landscape) skipAuto.current = false
  }, [handheld, immersive, landscape])

  useEffect(() => {
    if (!video) {
      setQueue(readWatchQueue())
      return
    }
    const extras = video.source === 'cleanstream' ? ownedVideos : library.state.history
    setQueue(ensureCurrentInQueue(video, extras))
  }, [library.state.history, video])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (event.key === 'n' && next) {
        event.preventDefault()
        goTo(next)
      } else if (event.key === 'p' && previous) {
        event.preventDefault()
        goTo(previous)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, previous])

  useEffect(() => {
    if (video) library.addToHistory(video)
    // Record once per video id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.id, video?.source])

  const youtubeWatchUrl = useMemo(
    () => (youtube ? `https://www.youtube.com/watch?v=${youtube.id}` : null),
    [youtube],
  )

  if (loading || staleVideo) {
    return (
      <div className="space-y-5">
        <WatchNav
          onBack={goBack}
          previousTitle={previous?.title}
          nextTitle={next?.title}
          onPrevious={previous ? () => goTo(previous) : undefined}
          onNext={next ? () => goTo(next) : undefined}
          fullView={immersive.active}
          onFullView={() => void toggleFullView()}
        />
        <VideoGridSkeleton count={1} />
      </div>
    )
  }
  if (error || !video) {
    return (
      <div className="space-y-5">
        <WatchNav onBack={goBack} fullView={immersive.active} onFullView={() => void toggleFullView()} />
        <ErrorState title="Unavailable" body={error ?? 'This video could not be opened.'} />
      </div>
    )
  }

  if (immersive.active) {
    return (
      <div className="relative flex h-[100dvh] w-full flex-col bg-black">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="pointer-events-auto">
            <WatchNav
              onBack={goBack}
              previousTitle={previous?.title}
              nextTitle={next?.title}
              onPrevious={previous ? () => goTo(previous) : undefined}
              onNext={next ? () => goTo(next) : undefined}
              fullView
              onFullView={() => void toggleFullView()}
            />
          </div>
        </div>
        <div ref={playerBox} className="min-h-0 flex-1">
          {youtube ? <YouTubeEmbed videoId={youtube.id} title={youtube.title} immersive /> : null}
          {owned ? (
            <Html5Player
              src={usingEnhanced && job?.outputId ? enhancedMediaUrl(job.outputId) : owned.src}
              poster={owned.poster}
              title={owned.title}
              captions={owned.captions}
              onProgress={(seconds) => library.addToHistory(owned, seconds)}
              onEnded={next ? () => goTo(next) : undefined}
              immersive
            />
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-5">
        <WatchNav
          onBack={goBack}
          previousTitle={previous?.title}
          nextTitle={next?.title}
          onPrevious={previous ? () => goTo(previous) : undefined}
          onNext={next ? () => goTo(next) : undefined}
          fullView={immersive.active}
          onFullView={() => void toggleFullView()}
        />
        <div ref={playerBox}>
          {youtube ? <YouTubeEmbed videoId={youtube.id} title={youtube.title} /> : null}
          {owned ? (
            <Html5Player
              src={usingEnhanced && job?.outputId ? enhancedMediaUrl(job.outputId) : owned.src}
              poster={owned.poster}
              title={owned.title}
              captions={owned.captions}
              onProgress={(seconds) => library.addToHistory(owned, seconds)}
              onEnded={next ? () => goTo(next) : undefined}
            />
          ) : null}
        </div>
        {owned ? (
          <div className="space-y-2">
            <EnhanceStatus
              inspection={inspection}
              job={job}
              usingEnhanced={usingEnhanced}
              onToggle={() => setUsingEnhanced((value) => !value)}
            />
            <p className="text-xs text-muted">Licensed MyTube file — HTML5 player with no advertising SDK.</p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <SourceBadge source={video.source} />
            <h1 className="mt-3 font-display text-3xl leading-tight">{video.title}</h1>
            <p className="mt-2 text-sm text-muted">
              {video.channelTitle}
              {video.publishedAt ? ` · ${formatDate(video.publishedAt)}` : ''}
              {video.duration ? ` · ${formatDuration(video.duration)}` : ''}
              {youtube?.viewCount ? ` · ${formatCompactNumber(youtube.viewCount)} views` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant={favorite ? 'primary' : 'ghost'} onClick={() => library.toggleFavorite(video)}>
              <Heart className="h-4 w-4" />
              {favorite ? 'Saved' : 'Favorite'}
            </Button>
            <Button variant="ghost" onClick={() => setPlaylistOpen(true)}>
              <ListPlus className="h-4 w-4" />
              Playlist
            </Button>
          </div>
        </div>

        {youtubeWatchUrl ? (
          <p className="text-sm text-muted">
            YouTube may display its own advertisements in the official player. MyTube does not overlay, block,
            extract, or upscale YouTube streams. Use the official player’s quality settings
            {inspection?.reason ? ` — ${inspection.reason}` : '.'}{' '}
            <a className="text-tide" href={youtubeWatchUrl} target="_blank" rel="noreferrer">
              Watch on YouTube
            </a>
          </p>
        ) : (
          <p className="text-sm text-muted">
            This is a MyTube-hosted file. License: {owned?.license}. It is not extracted from YouTube.
          </p>
        )}

        {video.description ? (
          <p className="whitespace-pre-wrap rounded-3xl border border-line bg-panel p-5 text-sm leading-7 text-muted">
            {video.description}
          </p>
        ) : null}
      </div>

      <aside className="space-y-4">
        <h2 className="font-display text-xl">Up next</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted">This is the last title in the current list.</p>
        ) : (
          upcoming.map((item) => (
            <Link
              key={videoKey(item)}
              to={watchPath(item)}
              className="flex gap-3 rounded-2xl border border-line bg-panel p-2 hover:border-muted"
            >
              {item.thumbnailUrl ? (
                <img src={item.thumbnailUrl} alt="" className="h-16 w-28 shrink-0 rounded-xl object-cover" />
              ) : null}
              <span className="min-w-0">
                <span className="line-clamp-2 block text-sm font-medium">{item.title}</span>
                <span className="mt-1 block text-xs text-muted">{item.channelTitle}</span>
              </span>
            </Link>
          ))
        )}
        <h2 className="font-display text-xl">Your lists</h2>
        {library.state.playlists.length === 0 ? (
          <p className="text-sm text-muted">Create a playlist to keep references — never downloaded copies.</p>
        ) : (
          library.state.playlists.map((playlist) => (
            <Link key={playlist.id} to={`/playlists/${playlist.id}`} className="block text-sm text-tide">
              {playlist.name} · {playlist.items.length}
            </Link>
          ))
        )}
      </aside>

      {playlistOpen ? (
        <Modal title="Add to playlist" onClose={() => setPlaylistOpen(false)}>
          <div className="space-y-3">
            {library.state.playlists.map((playlist) => (
              <Button
                key={playlist.id}
                variant="ghost"
                className="w-full justify-between"
                onClick={() => {
                  library.addToPlaylist(playlist.id, video)
                  setPlaylistOpen(false)
                }}
              >
                <span>{playlist.name}</span>
                <span className="text-muted">{playlist.items.length}</span>
              </Button>
            ))}
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                const created = library.createPlaylist(newPlaylist)
                if (created) library.addToPlaylist(created.id, video)
                setNewPlaylist('')
                setPlaylistOpen(false)
              }}
            >
              <input
                value={newPlaylist}
                onChange={(event) => setNewPlaylist(event.target.value)}
                placeholder="New playlist"
                aria-label="New playlist name"
                className="flex-1 rounded-full border border-line bg-raised px-3 py-2 text-sm"
              />
              <Button variant="primary" type="submit">
                Create
              </Button>
            </form>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
