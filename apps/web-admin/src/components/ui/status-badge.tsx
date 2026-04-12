import type { HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const statusBadgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]',
  {
    variants: {
      tone: {
        neutral: 'bg-[rgba(240,238,230,0.9)] text-[hsl(var(--muted-foreground))]',
        success: 'bg-[rgba(224,239,226,0.92)] text-emerald-900',
        warning: 'bg-[rgba(247,235,208,0.95)] text-amber-900',
        info: 'bg-[rgba(227,235,240,0.92)] text-sky-900',
        danger: 'bg-[rgba(245,225,222,0.95)] text-rose-900',
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
