import { describe, expect, it } from 'vitest'
import { parseWebVtt, toWebVtt } from '@/lib/vtt'

describe('WebVTT helpers', () => {
  it('round-trips timed cues', () => {
    const cues = [
      { start: 0, end: 4, text: 'Welcome to the movie.' },
      { start: 4.5, end: 9, text: 'Let us begin our journey.' },
    ]
    const raw = toWebVtt(cues)
    expect(raw.startsWith('WEBVTT')).toBe(true)
    expect(raw).toContain('00:00:00.000 --> 00:00:04.000')
    expect(parseWebVtt(raw)).toEqual(cues)
  })
})
