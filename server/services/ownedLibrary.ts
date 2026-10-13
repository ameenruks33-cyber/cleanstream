import { existsSync } from 'node:fs'
import { getOwnedVideo as getCatalogVideo, ownedVideos } from '../../src/data/ownedVideos.ts'
import type { OwnedVideo } from '../../src/types/index.ts'
import { FILE_ID_RE, INPUT_DIR, safeMediaFile } from './enhance/paths.ts'

export { ownedVideos }

export function getOwnedVideo(id: string): OwnedVideo | undefined {
  const catalog = getCatalogVideo(id)
  if (catalog) return catalog
  if (!FILE_ID_RE.test(id)) return undefined
  try {
    const file = safeMediaFile(INPUT_DIR, id, '.mp4')
    if (!existsSync(file)) return undefined
    return {
      id,
      source: 'cleanstream',
      title: 'Authorized upload',
      channelTitle: 'This computer',
      thumbnailUrl: '',
      src: `/api/enhance/source/${encodeURIComponent(id)}`,
      license: 'User-supplied authorized file stored on this computer',
      description: 'This file was uploaded locally. It is not a YouTube extract.',
    }
  } catch {
    return undefined
  }
}
