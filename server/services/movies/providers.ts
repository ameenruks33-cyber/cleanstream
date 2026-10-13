import type { AvailabilityStatus, MovieDetails, MovieNotification, MovieSummary, StreamingOffer } from '../../../src/types/movies.ts'

export type MovieSearchInput = {
  query: string
  year?: number
  language?: string
  originalLanguage?: string
  page?: number
}

export type MovieDetailsInput = {
  id: string
  language?: string
}

export interface MovieMetadataProvider {
  search(input: MovieSearchInput): Promise<{ items: MovieSummary[]; totalResults: number; page: number }>
  getDetails(
    input: MovieDetailsInput,
  ): Promise<Omit<MovieDetails, 'offers' | 'availabilityStatus' | 'availabilityNote' | 'justWatchUrl' | 'country' | 'inAppPlayback'>>
}

export type AvailabilityResult = {
  offers: StreamingOffer[]
  justWatchUrl?: string
  status: AvailabilityStatus
  note: string
}

export interface StreamingAvailabilityProvider {
  getOffers(movieId: string, country: string, title?: string): Promise<AvailabilityResult>
}

export interface OfficialPlaybackProvider {
  filterOfficialUrls(urls: Array<string | undefined>): string[]
}

export interface ReleaseNotificationProvider {
  diff(input: {
    movieId: string
    title: string
    country: string
    previousFingerprint?: string
    offers: StreamingOffer[]
  }): MovieNotification | null
}

export function offerFingerprint(offers: StreamingOffer[]): string {
  return offers
    .map((offer) => `${offer.providerId}:${offer.availabilityType}:${offer.providerName}`)
    .sort()
    .join('|')
}
