import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import { cn } from '@/lib/utils'

type AdminTableProps = {
  children: ReactNode
  className?: string
}

export function AdminTable({ children, className }: AdminTableProps) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full">{children}</table>
    </div>
  )
}

export function AdminTableRow({
  className,
  ...props
}: ComponentPropsWithoutRef<'tr'>) {
  return (
    <tr
      className={cn(
        'border-b border-border/70 align-top transition-colors hover:bg-[rgba(255,255,255,0.58)]',
        className,
      )}
      {...props}
    />
  )
}

export function AdminTableEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="app-muted-surface p-4 text-sm text-muted-foreground">
      {children}
    </div>
  )
}
