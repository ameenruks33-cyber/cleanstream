import { Link } from 'react-router-dom'
import { authorizedAccessLabel } from '@/lib/authorizedAccess'
import type { MovieSummary } from '@/types/movies'

export function MovieCard({ movie, country }: { movie: MovieSummary; country: string }) {
  const access = authorizedAccessLabel(movie.authorizedAccess || (movie.ownedVideoId ? 'library' : undefined))
  return (
    <Link
      to={`/movies/${movie.id}?country=${encodeURIComponent(country)}`}
      className="group overflow-hidden rounded-2xl border border-line bg-panel transition hover:border-tide"
    >
      <div className="aspect-[2/3] bg-raised">
        {movie.posterUrl ? (
          <img src={movie.posterUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted">No poster</div>
        )}
      </div>
      <div className="space-y-1 p-4">
        <h3 className="line-clamp-2 font-medium text-ink group-hover:text-tide">{movie.title}</h3>
        <p className="text-xs text-muted">
          {[movie.year, movie.originalLanguage.toUpperCase(), movie.voteAverage ? movie.voteAverage.toFixed(1) : '']
            .filter(Boolean)
            .join(' · ')}
        </p>
        {access ? <p className="text-xs text-tide">{access}</p> : null}
      </div>
    </Link>
  )
}

export function MovieGrid({ movies, country }: { movies: MovieSummary[]; country: string }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {movies.map((movie) => (
        <MovieCard key={movie.id} movie={movie} country={country} />
      ))}
    </div>
  )
}

export function MovieGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="animate-pulse overflow-hidden rounded-2xl border border-line bg-panel">
          <div className="aspect-[2/3] bg-raised" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-5/6 rounded bg-raised" />
            <div className="h-3 w-1/3 rounded bg-raised" />
          </div>
        </div>
      ))}
    </div>
  )
}
