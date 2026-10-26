import { useState } from 'react'

import { Button } from '@/components/ui/button'

// Caps a long list and reveals more on request, so pages stay scannable.
export function useShowMore<T>(rows: T[], pageSize = 25) {
  const [limit, setLimit] = useState(pageSize)
  const visible = rows.slice(0, limit)
  const remaining = rows.length - visible.length
  const more =
    remaining > 0 ? (
      <div className="flex justify-center pt-3">
        <Button onClick={() => setLimit((value) => value + pageSize)} size="sm" type="button" variant="outline">
          Show {Math.min(pageSize, remaining)} more
          <span className="ml-1 font-normal text-muted-foreground">({remaining} left)</span>
        </Button>
      </div>
    ) : null
  return { visible, more, reset: () => setLimit(pageSize) }
}

export function matchesSearch(term: string, values: Array<string | null | undefined>) {
  const needle = term.trim().toLowerCase()
  if (!needle) return true
  return values.join(' ').toLowerCase().includes(needle)
}
