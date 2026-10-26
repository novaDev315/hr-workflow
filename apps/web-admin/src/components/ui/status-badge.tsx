import type { HTMLAttributes, ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { formatStatus } from '@/lib/format'
import { cn } from '@/lib/utils'

const statusBadgeVariants = cva(
  'inline-flex max-w-full shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium leading-5',
  {
    variants: {
      tone: {
        neutral: 'bg-[rgba(240,238,230,0.95)] text-[hsl(var(--muted-foreground))]',
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

type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof statusBadgeVariants> & {
    /** Raw status/enum value; rendered through formatStatus. */
    value?: string | null
  }

// Only enum-like strings ("ON_LEAVE", "PENDING") are reformatted; ordinary
// text such as "v2.1" or "3 days" is shown as given.
const ENUM_LIKE = /^[A-Z][A-Z0-9_]*$/

function renderLabel(children: ReactNode, value?: string | null): ReactNode {
  if (value !== undefined) return formatStatus(value)
  if (typeof children === 'string' && ENUM_LIKE.test(children.trim())) {
    return formatStatus(children.trim())
  }
  return children
}

export function StatusBadge({ className, tone, value, children, ...props }: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ tone }), className)} {...props}>
      {renderLabel(children, value)}
    </span>
  )
}
