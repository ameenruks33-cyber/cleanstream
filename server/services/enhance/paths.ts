import { mkdirSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'

export const FILE_ID_RE = /^[a-z0-9-]{3,80}$/
export const OUTPUT_ID_RE = /^[a-z0-9-]{8,80}$/

export const MEDIA_ROOT = resolve(process.cwd(), 'media')
export const INPUT_DIR = resolve(MEDIA_ROOT, 'input')
export const OUTPUT_DIR = resolve(MEDIA_ROOT, 'output')

export function ensureMediaDirs(): void {
  mkdirSync(INPUT_DIR, { recursive: true })
  mkdirSync(OUTPUT_DIR, { recursive: true })
}

export function isInsideDir(dir: string, candidate: string): boolean {
  const rel = relative(resolve(dir), resolve(candidate))
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel) && !rel.split(sep).includes('..')
}

export function safeMediaFile(dir: string, id: string, ext: '.mp4' | '.json'): string {
  if (!OUTPUT_ID_RE.test(id) && !FILE_ID_RE.test(id)) {
    throw new Error('Invalid media id')
  }
  const target = resolve(dir, `${id}${ext}`)
  if (!isInsideDir(dir, target)) {
    throw new Error('Invalid media path')
  }
  return target
}
