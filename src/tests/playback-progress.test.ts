import { afterEach, describe, expect, it } from 'vitest'
import { readPlaybackProgress, writePlaybackProgress } from '@/lib/playbackProgress'

afterEach(() => {
  localStorage.clear()
})

describe('authorized media resume', () => {
  it('stores progress and ignores near-end timestamps', () => {
    writePlaybackProgress('cleanstream', 'sintel', 42, 800)
    expect(readPlaybackProgress('cleanstream', 'sintel')).toBe(42)
    writePlaybackProgress('cleanstream', 'sintel', 799, 800)
    expect(readPlaybackProgress('cleanstream', 'sintel')).toBe(42)
  })
})
