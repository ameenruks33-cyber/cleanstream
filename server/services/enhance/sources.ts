import { existsSync } from 'node:fs'
import { getOwnedVideo } from '../ownedLibrary.ts'
import { FILE_ID_RE, INPUT_DIR, safeMediaFile } from './paths.ts'

const ALLOWED_REMOTE_HOST = 'commondatastorage.googleapis.com'
const ALLOWED_REMOTE_PREFIX = '/gtv-videos-bucket/sample/'

export type AuthorizedSource =
  | { kind: 'local'; fileId: string; input: string; title: string }
  | { kind: 'remote'; fileId: string; input: string; title: string }

export function isAllowedRemoteSource(raw: string): boolean {
  try {
    const url = new URL(raw)
    return (
      url.protocol === 'https:' &&
      url.hostname === ALLOWED_REMOTE_HOST &&
      url.pathname.startsWith(ALLOWED_REMOTE_PREFIX) &&
      url.pathname.toLowerCase().endsWith('.mp4') &&
      !url.pathname.includes('..')
    )
  } catch {
    return false
  }
}

export function resolveAuthorizedSource(fileId: string): AuthorizedSource | null {
  if (!FILE_ID_RE.test(fileId)) return null

  const owned = getOwnedVideo(fileId)
  if (owned && isAllowedRemoteSource(owned.src)) {
    return { kind: 'remote', fileId, input: owned.src, title: owned.title }
  }

  try {
    const local = safeMediaFile(INPUT_DIR, fileId, '.mp4')
    if (existsSync(local)) {
      return { kind: 'local', fileId, input: local, title: fileId }
    }
  } catch {
    return null
  }
  return null
}
