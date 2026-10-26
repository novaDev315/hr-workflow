import { useMemo } from 'react'
import { useQuery } from '@apollo/client'
import {
  LEAVE_PENDING_QUERY,
  LEAVE_QUERY,
  type LeaveBalance,
  type LeaveRequestRow,
  type LeaveTypeRow,
} from './queries'

export interface LeaveData {
  leaveTypes: LeaveTypeRow[]
  leaveBalances: LeaveBalance[]
  leaveRequests: LeaveRequestRow[]
}

export type BalanceWithPending = LeaveBalance & { pendingDays: number }

/**
 * Leave types, balances and requests for one employee. Pending days come from
 * the server when it supports `pendingDays` (separate query, errors ignored so
 * an older backend cannot break the screen), otherwise from pending requests.
 */
export function useLeaveData(employeeId: string | null) {
  const query = useQuery<LeaveData>(LEAVE_QUERY, {
    variables: { employeeId, requestFilter: { employeeId } },
    skip: !employeeId,
  })
  const pendingQuery = useQuery<{ leaveBalances: Array<{ leaveTypeId: string; pendingDays?: number | null }> }>(
    LEAVE_PENDING_QUERY,
    { variables: { employeeId }, skip: !employeeId, errorPolicy: 'ignore' },
  )

  const balances = useMemo<BalanceWithPending[]>(() => {
    const serverPending = new Map(
      (pendingQuery.data?.leaveBalances ?? [])
        .filter((row) => typeof row.pendingDays === 'number')
        .map((row) => [row.leaveTypeId, row.pendingDays as number]),
    )
    const requests = query.data?.leaveRequests ?? []
    return (query.data?.leaveBalances ?? []).map((balance) => ({
      ...balance,
      pendingDays:
        serverPending.get(balance.leaveTypeId) ??
        requests
          .filter((request) => request.status === 'PENDING' && request.leaveTypeId === balance.leaveTypeId)
          .reduce((sum, request) => sum + request.totalDays, 0),
    }))
  }, [query.data, pendingQuery.data])

  return { ...query, balances, refetchPending: pendingQuery.refetch }
}
