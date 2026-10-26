import { gql, useQuery } from '@apollo/client'

import { canManageAccounts, useAdminSession } from '@/lib/auth-session'

// Asked in its own query so pages still render against a backend that does
// not expose `canViewPayroll` yet.
const REPORTS_PAYROLL_ACCESS_QUERY = gql`
  query ReportsPayrollAccess($periodMonth: String) {
    reportsDashboard(periodMonth: $periodMonth) {
      canViewPayroll
    }
  }
`

/**
 * Whether payroll numbers should be shown. Uses the server's answer when
 * available; otherwise falls back to the account role (ADMIN / HR_ADMIN).
 */
export function useCanViewPayroll(periodMonth: string) {
  const { account } = useAdminSession()
  const roleFallback = canManageAccounts(account)
  const { data, loading } = useQuery<{ reportsDashboard?: { canViewPayroll?: boolean } }>(
    REPORTS_PAYROLL_ACCESS_QUERY,
    {
      variables: { periodMonth },
      fetchPolicy: 'no-cache',
      errorPolicy: 'all',
    },
  )

  const serverValue = data?.reportsDashboard?.canViewPayroll
  return {
    canViewPayroll: typeof serverValue === 'boolean' ? serverValue : roleFallback,
    loading,
  }
}
