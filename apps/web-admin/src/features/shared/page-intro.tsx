import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

// Quiet page heading: serif title, one supporting line, actions on the right.
export function PageIntro({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="app-editorial text-[1.9rem] leading-[1.05] text-foreground sm:text-[2.15rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}

// Section heading used inside cards and anchored sections.
export function SectionHeading({
  title,
  description,
  actions,
  id,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  id?: string
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="app-editorial text-[1.3rem] leading-tight text-foreground" id={id}>
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}
