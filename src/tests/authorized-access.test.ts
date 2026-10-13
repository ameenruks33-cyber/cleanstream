import { describe, expect, it } from 'vitest'
import {
  AVAILABILITY_TYPE_ORDER,
  authorizedAccessFromOffers,
  authorizedAccessLabel,
  sortMoviesByAuthorizedAccess,
} from '@/lib/authorizedAccess'

describe('authorized access ranking', () => {
  it('prefers licensed files, then free, then ads, then paid storefronts', () => {
    expect(authorizedAccessFromOffers('sintel', ['ads'])).toBe('library')
    expect(authorizedAccessFromOffers(undefined, ['subscription', 'free'])).toBe('free')
    expect(authorizedAccessFromOffers(undefined, ['ads', 'rental'])).toBe('ads')
    expect(authorizedAccessFromOffers(undefined, ['subscription'])).toBe('storefront')
    expect(authorizedAccessFromOffers(undefined, [])).toBe('none')
    expect(AVAILABILITY_TYPE_ORDER[0]).toBe('free')
    expect(AVAILABILITY_TYPE_ORDER[1]).toBe('ads')
  })

  it('sorts search results so playable and free titles lead', () => {
    const sorted = sortMoviesByAuthorizedAccess([
      { authorizedAccess: 'storefront' },
      { authorizedAccess: 'none' },
      { authorizedAccess: 'free' },
      { authorizedAccess: 'library' },
      { authorizedAccess: 'ads' },
    ])
    expect(sorted.map((item) => item.authorizedAccess)).toEqual(['library', 'free', 'ads', 'storefront', 'none'])
    expect(authorizedAccessLabel('free')).toBe('Free (authorized)')
  })
})
