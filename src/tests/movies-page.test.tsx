import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { MovieLibraryProvider } from '@/app/MovieLibraryProvider'
import { MoviesPage } from '@/features/movies/MoviesPage'

vi.mock('@/services/api', () => ({
  fetchHealth: async () => ({
    ok: true,
    youtubeConfigured: false,
    moviesConfigured: true,
    tmdbConfigured: false,
    supabaseConfigured: false,
  }),
  searchMovies: async () => ({
    items: [],
    libraryMatches: [],
    page: 1,
    totalResults: 0,
    country: 'AE',
    attribution: { tmdb: 'TMDB', justWatch: 'JustWatch' },
  }),
  refreshMovieWatchlist: async () => ({ items: [], notifications: [], fingerprints: {} }),
}))

describe('Movies page', () => {
  it('keeps region selection without a second search form', () => {
    render(
      <MemoryRouter>
        <MovieLibraryProvider>
          <MoviesPage />
        </MovieLibraryProvider>
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Movies' })).toBeInTheDocument()
    expect(screen.getByLabelText('Watch region')).toBeInTheDocument()
    expect(screen.getByText(/United Arab Emirates/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Movie title')).not.toBeInTheDocument()
  })
})
