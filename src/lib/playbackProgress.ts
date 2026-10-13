const STORAGE_KEY = 'mytube.playback-progress.v1'

type ProgressMap = Record<string, { seconds: number; updatedAt: string }>

function key(source: string, id: string): string {
  return `${source}:${id}`
}

function readAll(): ProgressMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as ProgressMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function readPlaybackProgress(source: string, id: string): number {
  const entry = readAll()[key(source, id)]
  return typeof entry?.seconds === 'number' && Number.isFinite(entry.seconds) ? entry.seconds : 0
}

export function writePlaybackProgress(source: string, id: string, seconds: number, duration: number): void {
  if (!Number.isFinite(seconds) || seconds < 2) return
  if (Number.isFinite(duration) && duration > 0 && seconds > duration - 3) return
  const all = readAll()
  all[key(source, id)] = { seconds: Math.floor(seconds), updatedAt: new Date().toISOString() }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    /* quota */
  }
}
