import { sanitizeOfficialWatchLink } from '../../../src/lib/movieLinks.ts'
import type { OfficialPlaybackProvider } from './providers.ts'

export class HttpsOfficialPlaybackProvider implements OfficialPlaybackProvider {
  filterOfficialUrls(urls: Array<string | undefined>): string[] {
    const unique = new Set<string>()
    for (const url of urls) {
      const safe = sanitizeOfficialWatchLink(url)
      if (safe) unique.add(safe)
    }
    return [...unique]
  }
}
