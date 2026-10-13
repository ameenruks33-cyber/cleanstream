import type { AuthorizedAccessKind, AvailabilityType, MovieSummary } from '@/types/movies'

export const AVAILABILITY_TYPE_ORDER: AvailabilityType[] = ['free', 'ads', 'subscription', 'rental', 'purchase']

const ACCESS_RANK: Record<AuthorizedAccessKind, number> = {
  library: 0,
  free: 1,
  ads: 2,
  storefront: 3,
  none: 4,
}

export function authorizedAccessFromOffers(
  ownedVideoId: string | undefined,
  types: AvailabilityType[],
): AuthorizedAccessKind {
  if (ownedVideoId) return 'library'
  if (types.includes('free')) return 'free'
  if (types.includes('ads')) return 'ads'
  if (types.length > 0) return 'storefront'
  return 'none'
}

export function sortMoviesByAuthorizedAccess<T extends Pick<MovieSummary, 'authorizedAccess'>>(items: T[]): T[] {
  return [...items].sort(
    (left, right) => ACCESS_RANK[left.authorizedAccess ?? 'none'] - ACCESS_RANK[right.authorizedAccess ?? 'none'],
  )
}

export function authorizedAccessLabel(kind: AuthorizedAccessKind | undefined): string | null {
  if (kind === 'library') return 'Playable in MyTube'
  if (kind === 'free') return 'Free (authorized)'
  if (kind === 'ads') return 'Free with ads'
  if (kind === 'storefront') return 'Official storefront'
  return null
}
