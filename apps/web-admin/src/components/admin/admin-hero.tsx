import type { ReactNode } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type AdminHeroProps = {
  kicker: string
  title: string
  description?: string
  actions?: ReactNode
  compact?: boolean
  className?: string
}

export function AdminHero({
  kicker,
  title,
  description,
  actions,
  compact = false,
  className,
}: AdminHeroProps) {
  return (
    <Card className={cn(compact ? undefined : 'app-hero-surface', className)}>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="app-kicker">{kicker}</p>
          <h2
            className={cn(
              'mt-2 text-2xl font-semibold text-foreground',
              compact ? 'tracking-normal' : 'app-section-title text-[2.2rem]',
            )}
          >
            {title}
          </h2>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </CardContent>
    </Card>
  )
}
