import { useEffect, useRef, useState } from 'react'
import {
  Captions,
  Maximize,
  Minimize,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from 'lucide-react'
import type { CaptionTrack } from '@/types'
import { formatClock } from '@/lib/format'
import { cn } from '@/lib/cn'

type Props = {
  src: string
  poster?: string
  title: string
  captions?: CaptionTrack[]
  onProgress?: (seconds: number, duration: number) => void
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]

export function Html5Player({ src, poster, title, captions = [], onProgress }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [speed, setSpeed] = useState(1)
  const [fullscreen, setFullscreen] = useState(false)
  const [captionsOn, setCaptionsOn] = useState(true)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onTime = () => {
      setCurrent(video.currentTime)
      onProgress?.(video.currentTime, video.duration || 0)
    }
    const onMeta = () => setDuration(video.duration || 0)
    const onWait = () => setBuffered(true)
    const onPlay = () => {
      setBuffered(false)
      setPlaying(true)
    }
    const onPause = () => setPlaying(false)
    const onErr = () => setError('This file could not be played. Check the media URL and format.')
    video.addEventListener('timeupdate', onTime)
    video.addEventListener('loadedmetadata', onMeta)
    video.addEventListener('waiting', onWait)
    video.addEventListener('playing', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('error', onErr)
    return () => {
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('loadedmetadata', onMeta)
      video.removeEventListener('waiting', onWait)
      video.removeEventListener('playing', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('error', onErr)
    }
  }, [onProgress])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    for (const track of Array.from(video.textTracks)) {
      track.mode = captionsOn ? 'showing' : 'hidden'
    }
  }, [captionsOn, captions])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const resume = video.currentTime
    const wasPlaying = !video.paused && video.currentTime > 0
    const onLoaded = () => {
      if (resume > 0.25 && Number.isFinite(resume)) video.currentTime = resume
      if (wasPlaying) void video.play()
    }
    video.addEventListener('loadedmetadata', onLoaded)
    return () => video.removeEventListener('loadedmetadata', onLoaded)
  }, [src])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      const video = videoRef.current
      if (!video) return
      if (event.key === ' ' || event.key === 'k') {
        event.preventDefault()
        void togglePlay()
      } else if (event.key === 'ArrowRight') {
        video.currentTime = Math.min(video.duration || 0, video.currentTime + 5)
      } else if (event.key === 'ArrowLeft') {
        video.currentTime = Math.max(0, video.currentTime - 5)
      } else if (event.key === 'm') {
        toggleMute()
      } else if (event.key === 'f') {
        void toggleFullscreen()
      } else if (event.key === 'c') {
        setCaptionsOn((value) => !value)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  async function togglePlay() {
    const video = videoRef.current
    if (!video) return
    if (video.paused) await video.play()
    else video.pause()
  }

  function toggleMute() {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setMuted(video.muted)
  }

  async function toggleFullscreen() {
    const box = boxRef.current
    if (!box) return
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      setFullscreen(false)
    } else {
      await box.requestFullscreen()
      setFullscreen(true)
    }
  }

  return (
    <div
      ref={boxRef}
      className="overflow-hidden rounded-3xl border border-line bg-black"
      role="region"
      aria-label={`${title} player`}
      data-ad-free="true"
      data-ad-integrations="none"
    >
      <div className="relative aspect-video">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full bg-black"
          src={src}
          poster={poster}
          playsInline
          onClick={() => void togglePlay()}
        >
          {captions.map((track) => (
            <track
              key={track.src}
              kind="subtitles"
              src={track.src}
              srcLang={track.srclang}
              label={track.label}
              default={track.srclang === 'en'}
            />
          ))}
        </video>
        {buffered && playing ? (
          <div className="absolute inset-0 grid place-items-center text-sm text-white/80">Loading…</div>
        ) : null}
        {error ? (
          <div className="absolute inset-0 grid place-items-center bg-black/80 p-6 text-center text-sm text-white">
            {error}
          </div>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={current}
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={duration || 0}
            aria-valuenow={current}
            onChange={(event) => {
              const next = Number(event.target.value)
              if (videoRef.current) videoRef.current.currentTime = next
              setCurrent(next)
            }}
            className="h-1 w-full cursor-pointer accent-ember"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2 text-white">
            <button type="button" aria-label={playing ? 'Pause' : 'Play'} onClick={() => void togglePlay()}>
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <button type="button" aria-label={muted ? 'Unmute' : 'Mute'} onClick={toggleMute}>
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              aria-label="Volume"
              onChange={(event) => {
                const next = Number(event.target.value)
                setVolume(next)
                setMuted(next === 0)
                if (videoRef.current) {
                  videoRef.current.volume = next
                  videoRef.current.muted = next === 0
                }
              }}
              className="w-24 accent-tide"
            />
            <span className="text-xs tabular-nums">
              {formatClock(current)} / {formatClock(duration)}
            </span>
            <label className="ml-auto text-xs">
              Speed
              <select
                aria-label="Playback speed"
                className="ml-2 rounded-md bg-white/10 px-2 py-1"
                value={speed}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  setSpeed(next)
                  if (videoRef.current) videoRef.current.playbackRate = next
                }}
              >
                {SPEEDS.map((value) => (
                  <option key={value} value={value}>
                    {value}×
                  </option>
                ))}
              </select>
            </label>
            {captions.length > 0 ? (
              <button
                type="button"
                aria-label={captionsOn ? 'Hide captions' : 'Show captions'}
                aria-pressed={captionsOn}
                onClick={() => setCaptionsOn((value) => !value)}
                className={cn(captionsOn && 'text-tide')}
              >
                <Captions className="h-5 w-5" />
              </button>
            ) : null}
            <button
              type="button"
              aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
              onClick={() => void toggleFullscreen()}
            >
              {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
