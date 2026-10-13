export type VideoLanguageCode = 'ml' | 'ta' | 'en' | 'hi' | 'ar'
export type VideoLanguageMode = 'subtitles' | 'dubbed'

export type VideoLanguageOption = {
  code: VideoLanguageCode
  label: string
}

export const VIDEO_LANGUAGES: VideoLanguageOption[] = [
  { code: 'ml', label: 'Malayalam' },
  { code: 'ta', label: 'Tamil' },
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ar', label: 'Arabic' },
]

export const VIDEO_LANGUAGE_CODES = VIDEO_LANGUAGES.map((item) => item.code)

export type LanguageCue = {
  start: number
  end: number
  text: string
}

export type VideoLanguageTrack = {
  status: 'ready' | 'queued' | 'failed'
  videoId: string
  language: VideoLanguageCode
  mode: VideoLanguageMode
  trackUrl?: string
  audioUrl?: string
  cues?: LanguageCue[]
  jobId?: string
  error?: string
}

export function languageLabel(code: string): string {
  return VIDEO_LANGUAGES.find((item) => item.code === code)?.label ?? code
}
