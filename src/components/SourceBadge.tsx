import type { VideoSource } from '@/types'
import { cn } from '@/lib/cn'

export function SourceBadge({ source, className }: { source: VideoSource; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        source === 'youtube' ? 'bg-ink/80 text-canvas' : 'bg-tide text-white',
        className,
      )}
    >
      {source === 'youtube' ? 'YouTube' : 'CleanStream'}
    </span>
  )
}
