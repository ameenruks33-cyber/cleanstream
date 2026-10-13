import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMovieLibrary } from '@/app/MovieLibraryProvider'
import { Button } from '@/components/Button'
import { RegionSelect } from '@/features/movies/RegionSelect'
import { TMDB_LOGIN_API_URL, TMDB_SIGNUP_URL } from '@/lib/movieLinks'
import { fetchHealth, refreshMovieWatchlist } from '@/services/api'

export function MoviesPage() {
  const { state, setCountry, applyRefresh, dismissNotifications } = useMovieLibrary()
  const [tmdbReady, setTmdbReady] = useState(false)
  const watchlist = state.watchlist
  const watchlistIds = useMemo(() => watchlist.map((item) => item.id).join(','), [watchlist])
  const latestNotice = state.notifications[0]

  useEffect(() => {
    void fetchHealth().then((health) => setTmdbReady(health.tmdbConfigured))
  }, [])

  useEffect(() => {
    if (!watchlistIds) return
    const ids = watchlistIds.split(',').filter(Boolean)
    let cancelled = false
    void refreshMovieWatchlist({
      ids,
      country: state.country,
      previous: state.fingerprints,
    })
      .then((result) => {
        if (!cancelled) applyRefresh(result.fingerprints, result.notifications)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [applyRefresh, state.country, watchlistIds])

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Movies</h1>
        </div>
        <RegionSelect value={state.country} onChange={setCountry} />
      </div>

      {!tmdbReady ? (
        <p className="rounded-3xl border border-line bg-panel px-5 py-4 text-sm leading-6 text-muted">
          Search works now via Wikidata. For confirmed Netflix/Shahid/etc. lists,{' '}
          <a className="text-tide" href={TMDB_LOGIN_API_URL} target="_blank" rel="noreferrer">
            log in to TMDB
          </a>{' '}
          (or{' '}
          <a className="text-tide" href={TMDB_SIGNUP_URL} target="_blank" rel="noreferrer">
            create a free account
          </a>
          ), then paste the API key in Settings. The settings/api page is locked until you are logged in.
        </p>
      ) : null}

      {latestNotice ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-tide/40 bg-tide/10 px-5 py-4 text-sm">
          <p>
            <strong>{latestNotice.title}</strong> — {latestNotice.message}{' '}
            {latestNotice.offerNames.length ? `(${latestNotice.offerNames.join(', ')})` : ''}
          </p>
          <Button onClick={dismissNotifications}>Dismiss</Button>
        </div>
      ) : null}

      {watchlist.length ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">Watchlist</h2>
            <p className="text-xs text-muted">Checked against {state.country}</p>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {watchlist.map((movie) => (
              <Link
                key={movie.id}
                to={`/movies/${movie.id}?country=${encodeURIComponent(state.country)}`}
                className="w-28 shrink-0"
              >
                <div className="aspect-[2/3] overflow-hidden rounded-xl bg-raised">
                  {movie.posterUrl ? <img src={movie.posterUrl} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <p className="mt-2 line-clamp-2 text-xs">{movie.title}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
