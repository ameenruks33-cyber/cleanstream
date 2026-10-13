import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { LibraryProvider } from '@/app/LibraryProvider'
import { MovieLibraryProvider } from '@/app/MovieLibraryProvider'
import { SearchPage } from '@/features/search/SearchPage'

vi.mock('@/services/api', () => ({
  searchYoutube: async () => ({ items: [], nextPageToken: undefined }),
  searchMovies: async () => ({
    items: [],
    libraryMatches: [],
    page: 1,
    totalResults: 0,
    country: 'AE',
    attribution: { tmdb: 'TMDB', justWatch: 'JustWatch' },
  }),
}))

describe('unified search', () => {
  it('does not add an extra search screen besides the top bar', () => {
    render(
      <LibraryProvider>
        <MovieLibraryProvider>
          <MemoryRouter initialEntries={['/search']}>
            <SearchPage />
          </MemoryRouter>
        </MovieLibraryProvider>
      </LibraryProvider>,
    )
    expect(screen.queryByRole('heading', { level: 1, name: 'Search any movie or video' })).not.toBeInTheDocument()
    expect(screen.queryByText(/TMDB finds titles/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/One search\. Free to use/i)).not.toBeInTheDocument()
  })
})
