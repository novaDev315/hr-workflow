import type { HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const statusBadgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]',
  {
    variants: {
      tone: {
        neutral: 'bg-slate-100 text-slate-700',
        success: 'bg-emerald-100 text-emerald-800',
        warning: 'bg-amber-100 text-amber-800',
        info: 'bg-sky-100 text-sky-800',
        danger: 'bg-rose-100 text-rose-800',
        accent: 'bg-accent text-accent-foreground',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  }
)

type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof statusBadgeVariants>

export function StatusBadge({ className, tone, ...props }: StatusBadgeProps) {
  return <span className={cn(statusBadgeVariants({ tone }), className)} {...props} />
}
