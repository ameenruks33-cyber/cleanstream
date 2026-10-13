import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ownedVideos } from '@/data/ownedVideos'
import { VideoGrid } from '@/components/VideoGrid'
import { Button } from '@/components/Button'
import { uploadAuthorizedVideo } from '@/services/api'

export function LibraryPage() {
  const navigate = useNavigate()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const input = event.currentTarget.elements.namedItem('video') as HTMLInputElement | null
    const file = input?.files?.[0]
    if (!file) {
      setError('Choose an MP4 you own or are licensed to process.')
      return
    }
    if (file.type !== 'video/mp4' && !file.name.toLowerCase().endsWith('.mp4')) {
      setError('Only MP4 files can be uploaded.')
      return
    }
    try {
      const result = await uploadAuthorizedVideo(file)
      setMessage('Upload accepted. Opening the original now — enhancement runs in the background.')
      navigate(`/watch/cleanstream/${result.fileId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Independent player</p>
        <h1 className="mt-2 font-display text-4xl">CleanStream library</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
          These titles are open-licensed films streamed from a public sample host. They are not YouTube extracts.
          Playback starts on the original file. If FFmpeg is installed, a background worker can create a 4K-sized copy
          — that is upscaling, not recovered native 4K detail.
        </p>
      </div>
      <VideoGrid videos={ownedVideos} />

      <section className="rounded-3xl border border-line bg-panel p-6">
        <h2 className="font-display text-2xl">Your authorized files</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Upload an MP4 you own or are licensed to process. Files stay on this computer (80 MB max). YouTube videos
          cannot be uploaded, extracted, or enhanced here.
        </p>
        <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center" onSubmit={(event) => void onUpload(event)}>
          <input
            type="file"
            name="video"
            accept="video/mp4"
            aria-label="Authorized MP4 file"
            className="flex-1 text-sm"
          />
          <Button variant="primary" type="submit">
            Upload and enhance
          </Button>
        </form>
        {message ? <p className="mt-3 text-sm text-tide">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-ember">{error}</p> : null}
      </section>
    </div>
  )
}
