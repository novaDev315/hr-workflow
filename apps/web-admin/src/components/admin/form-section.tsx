import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type FormSectionProps = {
  title?: string
  description?: string
  children: ReactNode
  className?: string
}

export function FormSection({
  title,
  description,
  children,
  className,
}: FormSectionProps) {
  return (
    <section className={cn('app-muted-surface space-y-4 p-4', className)}>
      {title || description ? (
        <div>
          {title ? (
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          ) : null}
          {description ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function FormActions({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'sticky bottom-0 -mx-4 mt-4 flex flex-wrap gap-2 border-t border-border/70 bg-card/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5',
        className,
      )}
    >
      {children}
    </div>
  )
}
