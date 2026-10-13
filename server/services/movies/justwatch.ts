import { JUSTWATCH_ATTRIBUTION, justWatchSearchUrl } from '../../../src/lib/movieLinks.ts'
import type { AvailabilityResult, StreamingAvailabilityProvider } from './providers.ts'

export function estimatedJustWatchAvailability(title: string, country: string): AvailabilityResult {
  const justWatchUrl = justWatchSearchUrl(country, title)
  return {
    offers: [],
    justWatchUrl,
    status: 'estimated',
    note: `${JUSTWATCH_ATTRIBUTION} Confirmed provider-by-provider lists need a TMDB API key. Until then, MyTube opens the official JustWatch page for ${country}.`,
  }
}

export class JustWatchSearchAvailabilityProvider implements StreamingAvailabilityProvider {
  async getOffers(_movieId: string, country: string, title = ''): Promise<AvailabilityResult> {
    return estimatedJustWatchAvailability(title, country)
  }
}
