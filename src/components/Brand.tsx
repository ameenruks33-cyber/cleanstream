import { useId } from 'react'
import { cn } from '@/lib/cn'

export const APP_NAME = 'MyTube'
export const LOGO_SRC = '/logo.jpg'

const LETTERS = APP_NAME.split('')

export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src={LOGO_SRC}
      alt=""
      className={cn('h-9 w-9 rounded-2xl bg-black object-cover object-[50%_28%]', className)}
    />
  )
}

export function BrandLogo({ className }: { className?: string }) {
  return <img src={LOGO_SRC} alt="" className={cn('rounded-3xl bg-black object-contain', className)} />
}

export function WaveName({
  as: Tag = 'span',
  className,
}: {
  as?: 'span' | 'p' | 'h1'
  className?: string
}) {
  return (
    <Tag className={cn('mytube-wave', className)} aria-label={APP_NAME}>
      {LETTERS.map((letter, index) => (
        <span
          key={`${letter}-${index}`}
          className={cn('mytube-wave-letter', index < 2 ? 'is-white' : 'is-grad')}
          style={{ animationDelay: `${index * 0.11}s` }}
          aria-hidden="true"
        >
          {letter}
        </span>
      ))}
    </Tag>
  )
}

export function WaveLine({ className }: { className?: string }) {
  const gradientId = useId()
  return (
    <svg className={cn('mytube-wave-svg', className)} viewBox="0 0 140 14" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="140" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3ec4ff" />
          <stop offset="45%" stopColor="#8a4dff" />
          <stop offset="100%" stopColor="#ff7a32" />
        </linearGradient>
      </defs>
      <path
        className="mytube-wave-path"
        d="M0 9 Q 17.5 1 35 9 T 70 9 T 105 9 T 140 9"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-3 text-ink">
      <BrandMark />
      {!collapsed ? (
        <div className="min-w-0 leading-tight">
          <WaveName as="p" className="text-lg" />
          <WaveLine className="mt-1 w-24" />
        </div>
      ) : null}
    </div>
  )
}
