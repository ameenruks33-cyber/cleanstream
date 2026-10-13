import type { EnhanceJob, QualityInspection } from '@/types'

function labelFor(job: EnhanceJob | null, inspection: QualityInspection | null): string {
  if (job?.status === 'ready') return 'Enhanced copy ready'
  if (job?.status === 'running') return `Enhancing in the background (${job.progress}%)`
  if (job?.status === 'queued') return 'Enhancement queued'
  if (job?.status === 'failed') return 'Enhancement unavailable'
  if (job?.status === 'skipped') return 'Playing original'
  if (inspection && !inspection.enhanceable) return 'Original playback'
  return 'Checking source quality'
}

export function EnhanceStatus({
  inspection,
  job,
  usingEnhanced,
  onToggle,
}: {
  inspection: QualityInspection | null
  job: EnhanceJob | null
  usingEnhanced: boolean
  onToggle: () => void
}) {
  const quality = inspection?.source
  return (
    <section className="rounded-3xl border border-line bg-panel px-4 py-3" aria-live="polite">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">Background 4K engine</p>
      <p className="mt-1 text-sm text-ink">{labelFor(job, inspection)}</p>
      <p className="mt-1 text-sm leading-6 text-muted">{job?.message ?? inspection?.reason}</p>
      {quality ? (
        <p className="mt-2 text-xs text-muted">
          Source {quality.width ?? '?'}×{quality.height ?? '?'}
          {quality.fps ? ` · ${quality.fps} fps` : ''}
          {quality.codec ? ` · ${quality.codec}` : ''}
          {quality.bitrate ? ` · ${Math.round(quality.bitrate / 1000)} kbps` : ''}
        </p>
      ) : null}
      {job?.status === 'running' ? (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-raised">
          <div className="h-full bg-ember" style={{ width: `${Math.min(100, job.progress)}%` }} />
        </div>
      ) : null}
      {job?.status === 'ready' ? (
        <button type="button" className="mt-3 text-sm text-tide" onClick={onToggle}>
          {usingEnhanced ? 'Compare original' : 'Play enhanced copy'}
        </button>
      ) : null}
      <p className="mt-2 text-xs leading-5 text-muted">
        Upscaling makes a 3840×2160 file. It does not restore true 4K camera detail. YouTube videos are not processed
        here.
      </p>
    </section>
  )
}
