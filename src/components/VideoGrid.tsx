import { useLocation } from 'react-router-dom'
import type { VideoRef } from '@/types'
import { VideoCard } from '@/components/VideoCard'

export function VideoGrid({ videos }: { videos: VideoRef[] }) {
  const location = useLocation()
  const origin = `${location.pathname}${location.search}`
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {videos.map((video) => (
        <VideoCard key={`${video.source}-${video.id}`} video={video} queue={videos} origin={origin} />
      ))}
    </div>
  )
}
