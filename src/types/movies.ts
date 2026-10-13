export type AvailabilityType = 'subscription' | 'rental' | 'purchase' | 'free' | 'ads'
export type AvailabilityStatus = 'confirmed' | 'unavailable' | 'estimated'
export type AuthorizedAccessKind = 'library' | 'free' | 'ads' | 'storefront' | 'none'

export type WatchRegion = {
  code: string
  name: string
}

export type AuthorizedLibraryMatch = {
  videoId: string
  title: string
  posterUrl: string
  year?: number
  license: string
}

export type InAppPlayback =
  | { kind: 'owned-file'; videoId: string; title: string }
  | { kind: 'youtube-trailer'; videoId: string }
  | { kind: 'none' }

export type MovieSummary = {
  id: string
  title: string
  originalTitle: string
  originalLanguage: string
  year?: number
  posterUrl: string
  backdropUrl?: string
  overview: string
  popularity: number
  voteAverage?: number
  source: 'tmdb' | 'wikidata'
  tmdbId?: number
  ownedVideoId?: string
  authorizedAccess?: AuthorizedAccessKind
}

export type MoviePerson = {
  id: number
  name: string
  role: string
}

export type StreamingOffer = {
  providerId: number
  providerName: string
  logoUrl: string
  availabilityType: AvailabilityType
  country: string
  officialUrl: string
  source: 'justwatch-tmdb' | 'justwatch-search'
  lastVerifiedAt: string
}

export type MovieDetails = MovieSummary & {
  tagline?: string
  runtimeMinutes?: number
  releaseDate?: string
  genres: string[]
  spokenLanguages: string[]
  alternateTitles: string[]
  cast: MoviePerson[]
  crew: MoviePerson[]
  offers: StreamingOffer[]
  availabilityStatus: AvailabilityStatus
  availabilityNote: string
  justWatchUrl?: string
  country: string
  trailerYoutubeId?: string
  inAppPlayback: InAppPlayback
}

export type MovieSearchResponse = {
  items: MovieSummary[]
  libraryMatches: AuthorizedLibraryMatch[]
  page: number
  totalResults: number
  country: string
  attribution: {
    tmdb: string
    justWatch: string
  }
}

export type MovieNotification = {
  id: string
  movieId: string
  title: string
  country: string
  message: string
  createdAt: string
  offerNames: string[]
}
