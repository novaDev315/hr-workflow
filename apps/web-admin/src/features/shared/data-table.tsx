import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import { cn } from '@/lib/utils'

// Tables scroll inside their own container so the page never scrolls sideways.
export function DataTable({
  children,
  className,
  minWidth = 720,
  label,
}: {
  children: ReactNode
  className?: string
  minWidth?: number
  label?: string
}) {
  return (
    <div
      aria-label={label}
      className={cn(
        'relative overflow-x-auto rounded-[calc(var(--radius)-0.1rem)] border border-border/70 bg-card',
        className,
      )}
      role={label ? 'region' : undefined}
      tabIndex={label ? 0 : undefined}
    >
      <table className="w-full text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  )
}

export function Th({ className, ...props }: ComponentPropsWithoutRef<'th'>) {
  return (
    <th
      className={cn(
        'whitespace-nowrap border-b border-border/70 bg-secondary/40 px-4 py-2.5 text-left text-xs font-semibold normal-case tracking-normal text-muted-foreground',
        className,
      )}
      scope="col"
      {...props}
    />
  )
}

export function Td({ className, ...props }: ComponentPropsWithoutRef<'td'>) {
  return (
    <td
      className={cn('border-b border-border/60 px-4 py-3 align-middle text-foreground', className)}
      {...props}
    />
  )
}

export function Tr({ className, ...props }: ComponentPropsWithoutRef<'tr'>) {
  return (
    <tr
      className={cn('transition-colors hover:bg-secondary/45 [&:last-child>td]:border-b-0', className)}
      {...props}
    />
  )
}

export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: string
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-[calc(var(--radius)-0.1rem)] border border-dashed border-border px-5 py-8 text-center',
        className,
      )}
    >
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {children ? (
        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">{children}</p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}
