import type { LanguageCue } from '@/lib/videoLanguages'

function formatStamp(seconds: number): string {
  const clamped = Math.max(0, seconds)
  const hours = Math.floor(clamped / 3600)
  const minutes = Math.floor((clamped % 3600) / 60)
  const secs = clamped % 60
  const whole = Math.floor(secs)
  const millis = Math.round((secs - whole) * 1000)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(whole).padStart(2, '0')}.${String(millis).padStart(3, '0')}`
}

function parseStamp(raw: string): number {
  const match = raw.trim().match(/^(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/)
  if (!match) return 0
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000
}

export function toWebVtt(cues: LanguageCue[]): string {
  const body = cues
    .map((cue) => `${formatStamp(cue.start)} --> ${formatStamp(cue.end)}\n${cue.text}`)
    .join('\n\n')
  return `WEBVTT\n\n${body}\n`
}

export function parseWebVtt(raw: string): LanguageCue[] {
  const cues: LanguageCue[] = []
  const blocks = raw.replace(/^\uFEFF/, '').split(/\n\n+/)
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).filter((line) => line.trim() && line.trim() !== 'WEBVTT')
    const timing = lines.find((line) => line.includes('-->'))
    if (!timing) continue
    const [startRaw, endRaw] = timing.split('-->').map((part) => part.trim())
    const text = lines
      .filter((line) => line !== timing)
      .join('\n')
      .trim()
    if (!startRaw || !endRaw || !text) continue
    cues.push({ start: parseStamp(startRaw), end: parseStamp(endRaw), text })
  }
  return cues
}
