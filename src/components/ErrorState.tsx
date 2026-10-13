import { Button } from '@/components/Button'

export function ErrorState({
  title = 'Something went wrong',
  body,
  onRetry,
}: {
  title?: string
  body: string
  onRetry?: () => void
}) {
  return (
    <div className="rounded-3xl border border-ember/30 bg-ember/8 px-6 py-10 text-center">
      <h2 className="font-display text-2xl">{title}</h2>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted">{body}</p>
      {onRetry ? (
        <Button variant="ghost" className="mt-6" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  )
}
