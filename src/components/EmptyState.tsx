import type { ReactNode } from 'react'

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-panel px-6 py-16 text-center">
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">{body}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}
