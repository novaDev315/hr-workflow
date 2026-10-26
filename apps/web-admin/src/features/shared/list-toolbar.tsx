import { Search } from 'lucide-react'
import type { ReactNode } from 'react'

import { Input } from '@/components/ui/input'
import { plural } from '@/lib/format'
import { cn } from '@/lib/utils'

// The one toolbar for growing lists: search, optional filters, a live count
// and a way back to the full list.
export function ListToolbar({
  search,
  onSearchChange,
  searchLabel,
  searchPlaceholder,
  filters,
  total,
  shown,
  noun,
  onClear,
  className,
}: {
  search: string
  onSearchChange: (value: string) => void
  searchLabel: string
  searchPlaceholder: string
  filters?: ReactNode
  total: number
  shown: number
  noun: [singular: string, pluralForm?: string]
  onClear?: () => void
  className?: string
}) {
  const filtered = shown !== total
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label={searchLabel}
            className="h-10 pl-10"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            type="search"
            value={search}
          />
        </div>
        {filters ? <div className="flex min-w-0 flex-wrap gap-2 sm:flex-nowrap">{filters}</div> : null}
      </div>
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span aria-live="polite">
          {filtered ? `Showing ${shown} of ${plural(total, ...noun)}` : plural(total, ...noun)}
        </span>
        {filtered && onClear ? (
          <button
            className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onClear}
            type="button"
          >
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  )
}
