import { ownedVideos } from '../ownedLibrary.ts'
import { titlesLikelyMatch, yearsLikelyMatch } from '../../../src/lib/titleMatch.ts'
import type { AuthorizedLibraryMatch } from '../../../src/types/movies.ts'

function yearFromDate(value?: string): number | undefined {
  if (!value || value.length < 4) return undefined
  const year = Number(value.slice(0, 4))
  return Number.isInteger(year) ? year : undefined
}

function toMatch(video: (typeof ownedVideos)[number]): AuthorizedLibraryMatch {
  return {
    videoId: video.id,
    title: video.title,
    posterUrl: video.poster || video.thumbnailUrl,
    year: yearFromDate(video.publishedAt),
    license: video.license,
  }
}

export function matchOwnedLibrary(title: string, originalTitle?: string, year?: number): AuthorizedLibraryMatch | undefined {
  const hit = ownedVideos.find((video) => {
    const videoYear = yearFromDate(video.publishedAt)
    const yearOk = yearsLikelyMatch(year, videoYear)
    return (
      yearOk &&
      (titlesLikelyMatch(title, video.title) || Boolean(originalTitle && titlesLikelyMatch(originalTitle, video.title)))
    )
  })
  return hit ? toMatch(hit) : undefined
}

export function searchOwnedLibrary(query: string): AuthorizedLibraryMatch[] {
  return ownedVideos.filter((video) => titlesLikelyMatch(query, video.title)).map(toMatch)
}

export function resolveInAppPlayback(input: {
  title: string
  originalTitle?: string
  year?: number
  trailerYoutubeId?: string
}): { kind: 'owned-file'; videoId: string; title: string } | { kind: 'youtube-trailer'; videoId: string } | { kind: 'none' } {
  const owned = matchOwnedLibrary(input.title, input.originalTitle, input.year)
  if (owned) return { kind: 'owned-file', videoId: owned.videoId, title: owned.title }
  if (input.trailerYoutubeId) return { kind: 'youtube-trailer', videoId: input.trailerYoutubeId }
  return { kind: 'none' }
}
