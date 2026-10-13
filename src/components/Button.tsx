import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger' | 'quiet'
}

export function Button({ variant = 'quiet', className, ...props }: Props) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-ember text-white hover:brightness-110',
        variant === 'ghost' && 'border border-line bg-raised hover:border-muted',
        variant === 'danger' && 'bg-ember/15 text-ember hover:bg-ember/25',
        variant === 'quiet' && 'text-muted hover:bg-raised hover:text-ink',
        className,
      )}
      {...props}
    />
  )
}
