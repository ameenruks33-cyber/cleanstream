import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { VIDEO_LANGUAGES, type VideoLanguageMode, type VideoLanguageTrack } from '@/lib/videoLanguages'
import { applyVideoLanguage, fetchVideoLanguageJob } from '@/services/api'

export function VideoLanguageSwitcher({
  videoId,
  onApplied,
}: {
  videoId: string
  onApplied?: (track: VideoLanguageTrack) => void
}) {
  const [language, setLanguage] = useState('ml')
  const [mode, setMode] = useState<VideoLanguageMode>('subtitles')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)

  useEffect(() => {
    setLanguage('ml')
    setMode('subtitles')
    setStatus('')
    setBusy(false)
    setJobId(null)
  }, [videoId])

  useEffect(() => {
    if (!jobId) return
    const activeJobId = jobId
    let cancelled = false

    async function poll() {
      try {
        const result = await fetchVideoLanguageJob(activeJobId)
        if (cancelled) return
        if (result.status === 'ready') {
          setJobId(null)
          setBusy(false)
          setStatus(result.mode === 'dubbed' ? 'Dubbed audio is ready.' : 'Language track is ready.')
          onApplied?.(result)
          return
        }
        if (result.status === 'failed') {
          setJobId(null)
          setBusy(false)
          setStatus(result.error || 'Unable to process this video.')
        }
      } catch (error) {
        if (cancelled) return
        setJobId(null)
        setBusy(false)
        setStatus(error instanceof Error ? error.message : 'Unable to process this video.')
      }
    }

    void poll()
    const timer = window.setInterval(() => void poll(), 800)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [jobId, onApplied])

  async function applyLanguage() {
    setBusy(true)
    setStatus('')
    setJobId(null)
    let queued = false

    try {
      const result = await applyVideoLanguage({ videoId, language, mode })

      if (result.status === 'ready') {
        setStatus(mode === 'dubbed' ? 'Dubbed audio is ready.' : 'Language track is ready.')
        onApplied?.(result)
        return
      }

      if (result.jobId) {
        queued = true
        setJobId(result.jobId)
        setStatus(`Translation queued. Job ID: ${result.jobId}`)
        return
      }

      setStatus('Unable to process this video.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to process this video.')
    } finally {
      if (!queued) setBusy(false)
    }
  }

  return (
    <section className="rounded-3xl border border-line bg-panel px-4 py-4" aria-label="Audio and subtitles">
      <h3 className="text-xs uppercase tracking-[0.2em] text-muted">Audio & subtitles</h3>
      <p className="mt-1 text-sm text-muted">
        Choose Malayalam, Tamil, English, Hindi, or Arabic for this licensed file.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm" htmlFor="video-language">
          Preferred language
          <select
            id="video-language"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="mt-1 w-full rounded-full border border-line bg-raised px-3 py-2 text-sm"
          >
            {VIDEO_LANGUAGES.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm" htmlFor="language-mode">
          Playback mode
          <select
            id="language-mode"
            value={mode}
            onChange={(event) => setMode(event.target.value as VideoLanguageMode)}
            className="mt-1 w-full rounded-full border border-line bg-raised px-3 py-2 text-sm"
          >
            <option value="subtitles">Translated subtitles</option>
            <option value="dubbed">AI dubbed audio</option>
          </select>
        </label>
      </div>

      <Button className="mt-4" variant="primary" disabled={busy} onClick={() => void applyLanguage()}>
        {busy ? 'Processing...' : 'Apply language'}
      </Button>

      {status ? (
        <p className="mt-3 text-sm text-muted" role="status">
          {status}
        </p>
      ) : null}
    </section>
  )
}

export default VideoLanguageSwitcher
