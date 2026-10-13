import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { VideoRef } from '@/types'
import { formatDate, formatDuration } from '@/lib/format'
import { SourceBadge } from '@/components/SourceBadge'

export function VideoCard({ video }: { video: VideoRef }) {
  return (
    <motion.article whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 320, damping: 22 }}>
      <Link
        to={`/watch/${video.source}/${video.id}`}
        className="group block overflow-hidden rounded-2xl border border-line bg-panel focus-visible:outline-tide"
      >
        <div className="relative aspect-video overflow-hidden bg-raised">
          {video.thumbnailUrl ? (
            <img
              src={video.thumbnailUrl}
              alt=""
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="grid h-full place-items-center text-muted">No still</div>
          )}
          <div className="absolute left-3 top-3">
            <SourceBadge source={video.source} />
          </div>
          {video.duration ? (
            <span className="absolute bottom-3 right-3 rounded-md bg-canvas/85 px-1.5 py-0.5 text-[11px] font-medium">
              {formatDuration(video.duration)}
            </span>
          ) : null}
        </div>
        <div className="space-y-1 p-4">
          <h3 className="line-clamp-2 text-sm font-medium leading-5">{video.title}</h3>
          <p className="text-xs text-muted">{video.channelTitle}</p>
          {video.publishedAt ? <p className="text-[11px] text-muted">{formatDate(video.publishedAt)}</p> : null}
        </div>
      </Link>
    </motion.article>
  )
}
