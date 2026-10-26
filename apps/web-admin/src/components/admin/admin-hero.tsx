import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type AdminHeroProps = {
  /** Small eyebrow above the title. Optional; shown quietly when given. */
  kicker?: string
  /** Page name, e.g. "Payroll". Rendered as the serif page title. */
  title: string
  /** One short, task-oriented line. */
  description?: string
  actions?: ReactNode
  /** Kept for compatibility; the header is always compact now. */
  compact?: boolean
  /** Opt back into the warm banner surface (used sparingly). */
  variant?: 'header' | 'banner'
  className?: string
}

/**
 * Page header: serif title, one description line, actions on the right.
 * Roughly 80–96px tall on desktop; stacks on phones.
 */
export function AdminHero({
  kicker,
  title,
  description,
  actions,
  variant = 'header',
  className,
}: AdminHeroProps) {
  const isBanner = variant === 'banner'

  return (
    <header
      className={cn(
        'flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6',
        isBanner ? 'app-hero-surface px-5 py-5 sm:px-6' : 'pb-1 pt-1',
        className,
      )}
    >
      <div className="min-w-0">
        {kicker ? (
          <p className="app-kicker leading-4">{kicker}</p>
        ) : null}
        <h1
          className={cn(
            'app-page-title break-words text-foreground',
            kicker ? 'mt-1.5' : undefined,
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
          {actions}
        </div>
      ) : null}
    </header>
  )
}
