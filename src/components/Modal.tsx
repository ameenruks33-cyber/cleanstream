import { useEffect, type ReactNode } from 'react'
import { Button } from '@/components/Button'

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-canvas/70 p-4" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="w-full max-w-md rounded-3xl border border-line bg-panel p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="dialog-title" className="font-display text-xl">
            {title}
          </h2>
          <Button aria-label="Close dialog" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}
