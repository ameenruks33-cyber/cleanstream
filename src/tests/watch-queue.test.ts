import { afterEach, describe, expect, it } from 'vitest'
import {
  ensureCurrentInQueue,
  neighborsInQueue,
  readWatchQueue,
  rememberWatchQueue,
  safeWatchOrigin,
  watchPath,
  WATCH_QUEUE_KEY,
} from '@/lib/watchQueue'
import { ownedVideos } from '@/data/ownedVideos'

afterEach(() => {
  sessionStorage.clear()
})

describe('watch queue', () => {
  it('remembers a list and finds previous and next videos', () => {
    rememberWatchQueue(ownedVideos, '/library')
    const queue = readWatchQueue()
    expect(queue.origin).toBe('/library')
    const around = neighborsInQueue(queue.items, 'cleanstream', 'sintel')
    expect(around.previous?.id).toBe('elephants-dream')
    expect(around.next?.id).toBe('tears-of-steel')
    expect(watchPath(around.next!)).toBe('/watch/cleanstream/tears-of-steel')
  })

  it('rejects unsafe return paths', () => {
    expect(safeWatchOrigin('https://evil.example')).toBe('/')
    expect(safeWatchOrigin('//evil.example')).toBe('/')
    expect(safeWatchOrigin('/search?q=varkala')).toBe('/search?q=varkala')
  })

  it('inserts a deep-linked video so next still works', () => {
    const video = ownedVideos[0]!
    const queue = ensureCurrentInQueue(video, ownedVideos)
    expect(queue.items[0]?.id).toBe('big-buck-bunny')
    expect(neighborsInQueue(queue.items, video.source, video.id).next?.id).toBe('elephants-dream')
    expect(sessionStorage.getItem(WATCH_QUEUE_KEY)).toContain('big-buck-bunny')
  })
})
