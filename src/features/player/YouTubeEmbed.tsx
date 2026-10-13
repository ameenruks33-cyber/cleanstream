export function YouTubeEmbed({ videoId, title }: { videoId: string; title: string }) {
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?rel=0&modestbranding=1&origin=${encodeURIComponent(origin)}`

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-black" data-official-youtube-embed="true">
      <div className="relative aspect-video">
        <iframe
          title={title}
          src={src}
          data-official-youtube-embed="true"
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>
  )
}
