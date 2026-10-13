import type { MovieNotification } from '../../../src/types/movies.ts'
import { offerFingerprint, type ReleaseNotificationProvider } from './providers.ts'

export class OfferChangeNotificationProvider implements ReleaseNotificationProvider {
  diff(input: {
    movieId: string
    title: string
    country: string
    previousFingerprint?: string
    offers: StreamingOfferLike[]
  }): MovieNotification | null {
    const current = offerFingerprint(input.offers)
    if (!current) return null
    if (input.previousFingerprint === current) return null
    const added = input.previousFingerprint
      ? `New official viewing options in ${input.country}.`
      : `Official viewing options are available in ${input.country}.`
    return {
      id: `${input.movieId}:${input.country}:${current}`,
      movieId: input.movieId,
      title: input.title,
      country: input.country,
      message: added,
      createdAt: new Date().toISOString(),
      offerNames: [...new Set(input.offers.map((offer) => offer.providerName))],
    }
  }
}

type StreamingOfferLike = {
  providerId: number
  providerName: string
  availabilityType: import('../../../src/types/movies.ts').AvailabilityType
}
