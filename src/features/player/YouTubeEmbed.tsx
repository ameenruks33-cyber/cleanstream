import { cn } from '@/lib/cn'

export function YouTubeEmbed({
  videoId,
  title,
  immersive = false,
}: {
  videoId: string
  title: string
  immersive?: boolean
}) {
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?rel=0&modestbranding=1&origin=${encodeURIComponent(origin)}`

  return (
    <div
      className={cn(
        'overflow-hidden bg-black',
        immersive ? 'h-full min-h-0 rounded-none border-0' : 'rounded-3xl border border-line',
      )}
      data-official-youtube-embed="true"
    >
      <div className={cn('relative', immersive ? 'h-full' : 'aspect-video')}>
        <iframe
          title={title}
          src={src}
          data-official-youtube-embed="true"
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>
  )
}
