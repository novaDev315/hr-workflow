import type { ComponentPropsWithoutRef } from 'react'

import { cn } from '@/lib/utils'

export function RecordCard({
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('app-muted-surface p-4', className)} {...props} />
}
