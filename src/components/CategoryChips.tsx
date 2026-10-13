import { Link, useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/cn'

export const DISCOVERY_TOPICS = [
  'Documentary',
  'Design',
  'Science',
  'Music',
  'Education',
  'Technology',
  'Cinema',
  'Nature',
]

export function CategoryChips() {
  const [params] = useSearchParams()
  const current = params.get('q') ?? ''
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
      {DISCOVERY_TOPICS.map((topic) => {
        const active = current.toLowerCase() === topic.toLowerCase()
        return (
          <Link
            key={topic}
            to={`/search?q=${encodeURIComponent(topic)}`}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-sm transition',
              active
                ? 'border-ember bg-ember text-white'
                : 'border-line bg-panel text-muted hover:border-muted hover:text-ink',
            )}
          >
            {topic}
          </Link>
        )
      })}
    </div>
  )
}
