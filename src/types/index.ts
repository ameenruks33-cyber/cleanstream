export type VideoSource = 'youtube' | 'cleanstream'

export type VideoRef = {
  id: string
  source: VideoSource
  title: string
  channelTitle: string
  thumbnailUrl: string
  publishedAt?: string
  duration?: string
  description?: string
  embeddable?: boolean
}

export type YoutubeVideo = VideoRef & {
  source: 'youtube'
  channelId?: string
  viewCount?: string
  embeddable: boolean
}

export type OwnedVideo = VideoRef & {
  source: 'cleanstream'
  src: string
  poster?: string
  license: string
  captions?: CaptionTrack[]
}

export type CaptionTrack = {
  src: string
  label: string
  srclang: string
}

export type Playlist = {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
  items: VideoRef[]
}

export type HistoryItem = VideoRef & {
  watchedAt: string
  progressSeconds: number
}

export type ThemeMode = 'dark' | 'light' | 'system'

export type Preferences = {
  theme: ThemeMode
  reducedMotion: boolean
  analyticsConsent: boolean
  historyEnabled: boolean
}

export type LibraryState = {
  favorites: VideoRef[]
  playlists: Playlist[]
  history: HistoryItem[]
  searchHistory: string[]
  preferences: Preferences
}

export type YoutubeSearchResponse = {
  items: YoutubeVideo[]
  nextPageToken?: string
  totalResults?: number
  quotaNotice?: string
  mock?: boolean
}

export type ApiErrorBody = {
  error: string
  code: string
  details?: string
}

export type VideoQualityReport = {
  width?: number
  height?: number
  fps?: number
  codec?: string
  bitrate?: number
  durationSeconds?: number
  format?: string
}

export type EnhanceJob = {
  jobId: string
  fileId: string
  status: 'queued' | 'running' | 'ready' | 'failed' | 'skipped'
  stage: 'probe' | 'lanczos' | 'ai' | 'done'
  progress: number
  message: string
  source?: VideoQualityReport
  outputId?: string
  encoder?: string
  ai: { available: boolean; status: 'skipped' | 'queued' | 'running' | 'ready' | 'failed'; note: string }
}

export type QualityInspection = {
  enhanceable: boolean
  reason: string
  source?: VideoQualityReport
  title?: string
  player?: 'official-embed'
  videoId?: string
}
