import { useCallback, useState } from 'react'

/** Pull-to-refresh state for one or more refetch functions. */
export function useRefresh(...refetches: Array<(() => Promise<unknown>) | undefined>) {
  const [refreshing, setRefreshing] = useState(false)
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.allSettled(refetches.filter(Boolean).map((refetch) => refetch!()))
    } finally {
      setRefreshing(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, refetches)
  return { refreshing, onRefresh }
}
