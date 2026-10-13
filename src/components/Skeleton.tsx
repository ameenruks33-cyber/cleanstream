export function VideoCardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="aspect-video bg-raised" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-5/6 rounded bg-raised" />
        <div className="h-3 w-1/2 rounded bg-raised" />
      </div>
    </div>
  )
}

export function VideoGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <VideoCardSkeleton key={index} />
      ))}
    </div>
  )
}
