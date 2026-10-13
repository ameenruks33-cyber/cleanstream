import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { MovieLibraryProvider } from '@/app/MovieLibraryProvider'
import { MovieDetailPage } from '@/features/movies/MovieDetailPage'
import type { MovieDetails } from '@/types/movies'

const movie: MovieDetails = {
  id: '338051',
  title: 'Thani Oruvan',
  originalTitle: 'Thani Oruvan',
  originalLanguage: 'ta',
  year: 2015,
  posterUrl: '',
  overview: 'A cop and a scientist-businessman.',
  popularity: 1,
  source: 'tmdb',
  tmdbId: 338051,
  genres: ['Thriller'],
  spokenLanguages: ['Tamil'],
  alternateTitles: [],
  cast: [],
  crew: [],
  offers: [
    {
      providerId: 1,
      providerName: 'Sun Nxt',
      logoUrl: '',
      availabilityType: 'subscription',
      country: 'AE',
      officialUrl: 'https://www.justwatch.com/ae/movie/thani-oruvan',
      source: 'justwatch-tmdb',
      lastVerifiedAt: '2026-10-13T00:00:00.000Z',
    },
  ],
  availabilityStatus: 'confirmed',
  availabilityNote: 'Streaming availability data is provided by JustWatch.',
  justWatchUrl: 'https://www.justwatch.com/ae/movie/thani-oruvan',
  country: 'AE',
  trailerYoutubeId: 'abcdefghijk',
  inAppPlayback: { kind: 'youtube-trailer', videoId: 'abcdefghijk' },
}

vi.mock('@/services/api', () => ({
  fetchMovie: async () => movie,
}))

describe('Movie detail playback', () => {
  it('plays the official trailer in MyTube and does not claim to host the licensed film', async () => {
    render(
      <MemoryRouter initialEntries={['/movies/338051?country=AE']}>
        <MovieLibraryProvider>
          <Routes>
            <Route path="/movies/:id" element={<MovieDetailPage />} />
          </Routes>
        </MovieLibraryProvider>
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { name: 'Watch in MyTube' })).toBeInTheDocument()
    expect(screen.getByTitle('Thani Oruvan trailer')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Watch trailer here' })).toHaveAttribute(
      'href',
      '/watch/youtube/abcdefghijk',
    )
    expect(screen.getByText(/do not allow MyTube to stream it/i)).toBeInTheDocument()
    expect(screen.getByText('Sun Nxt')).toBeInTheDocument()
  })
})
