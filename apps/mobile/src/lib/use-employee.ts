import { useQuery } from '@apollo/client'
import { useAuthSession, type AccountProfile } from './auth-session'
import { ME_QUERY } from './queries'

/** The signed-in account, preferring fresh `me` data over the stored copy. */
export function useEmployee() {
  const storedAccount = useAuthSession((state) => state.account)
  const query = useQuery<{ me: AccountProfile }>(ME_QUERY)
  const account = query.data?.me ?? storedAccount
  return {
    account,
    employeeId: account?.employeeId ?? null,
    loading: query.loading && !account,
    error: account ? undefined : query.error,
    refetch: query.refetch,
  }
}
