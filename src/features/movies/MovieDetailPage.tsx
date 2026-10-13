import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMovieLibrary } from '@/app/MovieLibraryProvider'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { RegionSelect } from '@/features/movies/RegionSelect'
import { YouTubeEmbed } from '@/features/player/YouTubeEmbed'
import { formatDate } from '@/lib/format'
import { AVAILABILITY_TYPE_ORDER } from '@/lib/authorizedAccess'
import { JUSTWATCH_ATTRIBUTION, TMDB_ATTRIBUTION, isOfficialWatchLink } from '@/lib/movieLinks'
import { YOUTUBE_ID_RE, validateMovieId } from '@/lib/validation'
import { fetchMovie } from '@/services/api'
import type { AvailabilityType, MovieDetails } from '@/types/movies'

const TYPE_LABEL: Record<AvailabilityType, string> = {
  subscription: 'Subscription',
  rental: 'Rent',
  purchase: 'Buy',
  free: 'Free',
  ads: 'Ads',
}

export function MovieDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { state, setCountry, toggleWatchlist, isOnWatchlist } = useMovieLibrary()
  const country = params.get('country') || state.country
  const [movie, setMovie] = useState<MovieDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const parsed = validateMovieId(String(id ?? ''))
    if (!parsed.ok) {
      setError(parsed.error)
      setLoading(false)
      return
    }
    const movieId = parsed.value
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      try {
        const result = await fetchMovie(movieId, country)
        if (!cancelled) setMovie(result)
      } catch (err) {
        if (!cancelled) {
          setMovie(null)
          setError(err instanceof Error ? err.message : 'Could not load this movie.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [id, country])

  const grouped = useMemo(() => {
    const map = new Map<AvailabilityType, MovieDetails['offers']>()
    for (const offer of movie?.offers ?? []) {
      const list = map.get(offer.availabilityType) ?? []
      list.push(offer)
      map.set(offer.availabilityType, list)
    }
    return map
  }, [movie])

  if (loading) {
    return <div className="animate-pulse rounded-3xl border border-line bg-panel p-8 text-sm text-muted">Loading title…</div>
  }
  if (error) return <ErrorState body={error} />
  if (!movie) return <EmptyState title="Movie not found" body="This title is missing from the metadata provider." />

  const saved = isOnWatchlist(movie.id)
  const ownedPlayback = movie.inAppPlayback.kind === 'owned-file' ? movie.inAppPlayback : undefined
  const trailerId =
    movie.inAppPlayback.kind === 'youtube-trailer'
      ? movie.inAppPlayback.videoId
      : movie.trailerYoutubeId && YOUTUBE_ID_RE.test(movie.trailerYoutubeId)
        ? movie.trailerYoutubeId
        : undefined
  const statusLabel =
    movie.availabilityStatus === 'confirmed'
      ? 'Confirmed availability'
      : movie.availabilityStatus === 'unavailable'
        ? 'No confirmed offers in this region'
        : 'Estimated / incomplete'

  return (
    <article className="space-y-8">
      <p className="text-xs">
        <Link to="/movies" className="text-muted hover:text-ink">
          ← Movies
        </Link>
      </p>
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <div className="overflow-hidden rounded-3xl border border-line bg-raised">
          {movie.posterUrl ? <img src={movie.posterUrl} alt="" className="w-full object-cover" /> : null}
        </div>
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted">{movie.originalLanguage.toUpperCase()}</p>
              <h1 className="mt-2 font-display text-4xl">{movie.title}</h1>
              {movie.originalTitle !== movie.title ? <p className="mt-1 text-sm text-muted">{movie.originalTitle}</p> : null}
            </div>
            <RegionSelect
              value={country}
              onChange={(next) => {
                setCountry(next)
                navigate(`/movies/${id}?country=${encodeURIComponent(next)}`, { replace: true })
              }}
            />
          </div>
          <p className="text-sm text-muted">
            {[movie.year, movie.runtimeMinutes ? `${movie.runtimeMinutes} min` : '', formatDate(movie.releaseDate)]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="text-sm leading-7 text-muted">{movie.overview}</p>
          {movie.genres.length ? <p className="text-sm text-muted">{movie.genres.join(' · ')}</p> : null}
          <div className="flex flex-wrap gap-3">
            {ownedPlayback ? (
              <Link
                to={`/watch/cleanstream/${ownedPlayback.videoId}`}
                className="inline-flex items-center justify-center rounded-full bg-ember px-4 py-2 text-sm font-medium text-white hover:brightness-110"
              >
                Play full movie here
              </Link>
            ) : trailerId ? (
              <Link
                to={`/watch/youtube/${trailerId}`}
                className="inline-flex items-center justify-center rounded-full bg-ember px-4 py-2 text-sm font-medium text-white hover:brightness-110"
              >
                Watch trailer here
              </Link>
            ) : null}
            <Button
              variant={saved ? 'ghost' : trailerId ? 'ghost' : 'primary'}
              onClick={() =>
                toggleWatchlist({
                  id: movie.id,
                  title: movie.title,
                  originalTitle: movie.originalTitle,
                  posterUrl: movie.posterUrl,
                  year: movie.year,
                  country,
                  addedAt: new Date().toISOString(),
                })
              }
            >
              {saved ? 'Remove from watchlist' : 'Add to watchlist'}
            </Button>
          </div>
        </div>
      </div>

      {ownedPlayback ? (
        <section className="space-y-3">
          <h2 className="font-display text-2xl">Watch in MyTube</h2>
          <p className="text-sm leading-6 text-muted">
            This title matches a licensed file in your MyTube library. Playback stays in this app. Subscription apps
            like Sun Nxt or Netflix are listed below only as official storefronts — MyTube does not stream their
            catalogs.
          </p>
        </section>
      ) : trailerId ? (
        <section className="space-y-3">
          <h2 className="font-display text-2xl">Watch in MyTube</h2>
          <p className="text-sm leading-6 text-muted">
            Official YouTube trailer, played in YouTube’s player. The full film from Sun Nxt, Netflix, Apple TV, and
            other stores stays in those licensed apps — they do not allow MyTube to stream it.
          </p>
          <YouTubeEmbed videoId={trailerId} title={`${movie.title} trailer`} />
        </section>
      ) : null}

      <section className="rounded-3xl border border-line bg-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl">Where to watch in {movie.country}</h2>
          <span
            className={
              movie.availabilityStatus === 'confirmed'
                ? 'rounded-full bg-tide/15 px-3 py-1 text-xs text-tide'
                : 'rounded-full bg-raised px-3 py-1 text-xs text-muted'
            }
          >
            {statusLabel}
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted">{movie.availabilityNote}</p>
        <p className="mt-2 text-sm leading-6 text-muted">
          Open a listed service to watch the full movie in its official player. MyTube only plays official YouTube
          trailers and files you are allowed to host.
        </p>
        {grouped.size === 0 ? (
          <p className="mt-4 text-sm text-muted">
            No verified subscription, rental, purchase, or free option in this country yet. Try another region, or check
            back when the background refresh picks up a licensed offer.
          </p>
        ) : (
          <div className="mt-6 space-y-6">
            {AVAILABILITY_TYPE_ORDER.filter((type) => grouped.has(type)).map((type) => {
              const offers = grouped.get(type) ?? []
              return (
              <div key={type}>
                <h3 className="text-sm font-medium">{TYPE_LABEL[type]}</h3>
                <ul className="mt-3 flex flex-wrap gap-3">
                  {offers.map((offer) => (
                    <li key={`${offer.providerId}-${offer.availabilityType}`}>
                      {offer.officialUrl && isOfficialWatchLink(offer.officialUrl) ? (
                        <a
                          href={offer.officialUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 rounded-2xl border border-line bg-canvas px-3 py-2 text-sm hover:border-tide"
                        >
                          {offer.logoUrl ? <img src={offer.logoUrl} alt="" className="h-8 w-8 rounded" /> : null}
                          {offer.providerName}
                        </a>
                      ) : (
                        <span className="flex items-center gap-2 rounded-2xl border border-line bg-canvas px-3 py-2 text-sm">
                          {offer.logoUrl ? <img src={offer.logoUrl} alt="" className="h-8 w-8 rounded" /> : null}
                          {offer.providerName}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              )
            })}
          </div>
        )}
        {movie.justWatchUrl && isOfficialWatchLink(movie.justWatchUrl) ? (
          <p className="mt-4 text-sm">
            <a className="text-tide" href={movie.justWatchUrl} target="_blank" rel="noreferrer">
              Open official JustWatch page
            </a>
          </p>
        ) : null}
        <p className="mt-4 text-xs leading-5 text-muted">
          {JUSTWATCH_ATTRIBUTION} {TMDB_ATTRIBUTION}
        </p>
      </section>

      {movie.cast.length ? (
        <section>
          <h2 className="font-display text-2xl">Cast</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            {movie.cast.map((person) => `${person.name}${person.role ? ` (${person.role})` : ''}`).join(' · ')}
          </p>
        </section>
      ) : null}
      {movie.alternateTitles.length ? (
        <section>
          <h2 className="font-display text-2xl">Also known as</h2>
          <p className="mt-3 text-sm text-muted">{movie.alternateTitles.join(' · ')}</p>
        </section>
      ) : null}
      {movie.spokenLanguages.length ? (
        <p className="text-sm text-muted">Spoken languages: {movie.spokenLanguages.join(', ')}</p>
      ) : null}
    </article>
  )
}
