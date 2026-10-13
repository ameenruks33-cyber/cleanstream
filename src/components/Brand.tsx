import { cn } from '@/lib/cn'

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('h-8 w-8', className)} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="currentColor" className="text-raised" />
      <path
        d="M5 21c5-9 7.5-9 12.5 0s7.5 9 12.5 0"
        fill="none"
        stroke="#E24B3B"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="22" cy="10" r="2.4" fill="#5B8CFF" />
    </svg>
  )
}

export function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-3 text-ink">
      <BrandMark />
      {!collapsed ? (
        <div className="leading-tight">
          <p className="font-display text-lg tracking-tight">CleanStream</p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Quiet video</p>
        </div>
      ) : null}
    </div>
  )
}
