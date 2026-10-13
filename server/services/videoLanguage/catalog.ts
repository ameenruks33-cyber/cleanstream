import { getOwnedVideo } from '../ownedLibrary.ts'
import type { LanguageCue, VideoLanguageCode, VideoLanguageMode } from '../../../src/lib/videoLanguages.ts'
import { languageLabel } from '../../../src/lib/videoLanguages.ts'
import { toWebVtt } from '../../../src/lib/vtt.ts'
import { translateLine } from './translate.ts'

type SourceCue = { start: number; end: number; en: string }

const SOURCE: Record<string, SourceCue[]> = {
  'big-buck-bunny': [
    { start: 0, end: 4, en: 'Big Buck Bunny — an open movie by the Blender Foundation.' },
    { start: 4.5, end: 9, en: 'This file is streamed as a licensed MyTube library title, not a YouTube extract.' },
  ],
  'elephants-dream': [
    { start: 0, end: 4, en: "Elephant's Dream — an open movie by the Blender Foundation." },
    { start: 4.5, end: 9, en: 'This file is streamed as a licensed MyTube library title, not a YouTube extract.' },
  ],
  sintel: [
    { start: 0, end: 4, en: 'Sintel — an open movie by the Blender Foundation.' },
    { start: 4.5, end: 9, en: 'This file is streamed as a licensed MyTube library title, not a YouTube extract.' },
  ],
  'tears-of-steel': [
    { start: 0, end: 4, en: 'Tears of Steel — an open movie by the Blender Foundation.' },
    { start: 4.5, end: 9, en: 'This file is streamed as a licensed MyTube library title, not a YouTube extract.' },
  ],
}

export function findAuthorizedVideo(videoId: string) {
  const video = getOwnedVideo(videoId)
  if (!video) return null
  return { id: video.id, title: video.title, src: video.src }
}

export function cuesFor(videoId: string, language: VideoLanguageCode): LanguageCue[] | null {
  const source = SOURCE[videoId]
  if (!source) return null
  return source.map((cue) => ({
    start: cue.start,
    end: cue.end,
    text: translateLine(cue.en, language),
  }))
}

export function findTranslatedTrack(videoId: string, language: VideoLanguageCode, mode: VideoLanguageMode) {
  const cues = cuesFor(videoId, language)
  if (!cues) return null
  return {
    url: `/api/video-language/media/${encodeURIComponent(videoId)}/${language}.vtt`,
    audioUrl: undefined as string | undefined,
    cues,
    label: languageLabel(language),
    mode,
  }
}

export function renderTrackVtt(videoId: string, language: VideoLanguageCode): string | null {
  const cues = cuesFor(videoId, language)
  if (!cues) return null
  return toWebVtt(cues)
}
