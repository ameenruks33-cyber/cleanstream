import { ChevronLeft, Maximize2, Minimize2, SkipBack, SkipForward } from 'lucide-react'
import { Button } from '@/components/Button'

type Props = {
  onBack: () => void
  previousTitle?: string
  nextTitle?: string
  onPrevious?: () => void
  onNext?: () => void
  fullView?: boolean
  onFullView?: () => void
}

export function WatchNav({
  onBack,
  previousTitle,
  nextTitle,
  onPrevious,
  onNext,
  fullView = false,
  onFullView,
}: Props) {
  return (
    <nav aria-label="Video navigation" className="flex flex-wrap items-center gap-2">
      <Button variant="ghost" type="button" onClick={onBack}>
        <ChevronLeft className="h-4 w-4" />
        Back
      </Button>
      <div className="ml-auto flex min-w-0 flex-wrap justify-end gap-2">
        {onFullView ? (
          <Button variant={fullView ? 'primary' : 'ghost'} type="button" onClick={onFullView}>
            {fullView ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            {fullView ? 'Exit full view' : 'Full view'}
          </Button>
        ) : null}
        <Button variant="ghost" type="button" disabled={!onPrevious} onClick={onPrevious}>
          <SkipBack className="h-4 w-4" />
          Previous
          <span className="sr-only">{previousTitle ? `: ${previousTitle}` : ''}</span>
        </Button>
        <Button variant="primary" type="button" disabled={!onNext} onClick={onNext}>
          Next
          <SkipForward className="h-4 w-4" />
          <span className="sr-only">{nextTitle ? `: ${nextTitle}` : ''}</span>
        </Button>
      </div>
      {nextTitle ? (
        <p className="w-full text-right text-xs text-muted">Up next: {nextTitle}</p>
      ) : null}
    </nav>
  )
}
