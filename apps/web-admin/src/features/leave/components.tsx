import { useQuery } from '@apollo/client'
import { AlertTriangle, Pencil, XCircle } from 'lucide-react'

import {
  AdminTable,
  AdminTableCell,
  AdminTableHead,
  AdminTableRow,
} from '@/components/admin/admin-table'
import { RecordCard } from '@/components/admin/record-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDateTime, formatDayRange, formatNumber, plural } from '@/lib/format'
import { isSchemaMismatch } from '@/lib/graphql-errors'

import {
  LEAVE_BALANCES_LEGACY_QUERY,
  LEAVE_BALANCES_QUERY,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveType,
} from './graphql'
import { leaveStatusTone } from './presentation'

function days(value: number) {
  return formatNumber(value, Number.isInteger(value) ? 0 : 1)
}

/* ---------- Balance context for approvers ---------- */

function useLeaveBalances(employeeId: string) {
  const current = useQuery<{ leaveBalances: LeaveBalance[] }>(LEAVE_BALANCES_QUERY, {
    variables: { employeeId },
    fetchPolicy: 'no-cache',
  })
  const needsLegacy = Boolean(current.error && isSchemaMismatch(current.error))
  const legacy = useQuery<{ leaveBalances: LeaveBalance[] }>(LEAVE_BALANCES_LEGACY_QUERY, {
    variables: { employeeId },
    fetchPolicy: 'no-cache',
    skip: !needsLegacy,
  })

  return {
    balances: needsLegacy ? legacy.data?.leaveBalances : current.data?.leaveBalances,
    loading: current.loading || legacy.loading,
    failed: needsLegacy ? Boolean(legacy.error) : Boolean(current.error),
    hasServerPending: !needsLegacy,
  }
}

type BalanceView =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'none' }
  | { kind: 'ready'; balance: LeaveBalance; pending: number; afterApproval: number }

// Balance context for one pending request. The card uses `afterApproval` to
// ask for confirmation before approving beyond the allowance.
function useBalanceView(request: LeaveRequest, pendingRequests: LeaveRequest[]): BalanceView {
  const { balances, loading, failed, hasServerPending } = useLeaveBalances(request.employee.id)

  if (loading) return { kind: 'loading' }
  if (failed) return { kind: 'failed' }

  const balance = balances?.find((entry) => entry.leaveTypeId === request.leaveType.id)
  if (!balance) return { kind: 'none' }

  // New API: pendingDays from the server, availableDays already excludes it.
  // Older API: add up this employee's pending requests of the same type.
  const pending =
    hasServerPending && typeof balance.pendingDays === 'number'
      ? balance.pendingDays
      : pendingRequests
          .filter(
            (entry) =>
              entry.employee.id === request.employee.id &&
              entry.leaveType.id === request.leaveType.id,
          )
          .reduce((sum, entry) => sum + entry.totalDays, 0)
  const afterApproval =
    hasServerPending && typeof balance.pendingDays === 'number'
      ? balance.availableDays
      : balance.allocatedDays - balance.usedDays - pending

  return { kind: 'ready', balance, pending, afterApproval }
}

function LeaveBalanceSummary({ request, view }: { request: LeaveRequest; view: BalanceView }) {
  if (view.kind === 'loading') {
    return <p className="text-[13px] text-muted-foreground">Checking balance…</p>
  }
  if (view.kind === 'failed') {
    return <p className="text-[13px] text-muted-foreground">Balance unavailable.</p>
  }
  if (view.kind === 'none') {
    return (
      <p className="text-[13px] text-muted-foreground">
        No {request.leaveType.name.toLowerCase()} allowance for this employee this year.
      </p>
    )
  }
  const { balance, pending, afterApproval } = view

  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-xl bg-card/70 px-3 py-2.5 text-[13px] sm:grid-cols-4">
        <div className="min-w-0">
          <dt className="text-muted-foreground">Allocated</dt>
          <dd className="font-semibold tabular-nums text-foreground">{days(balance.allocatedDays)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground">Used</dt>
          <dd className="font-semibold tabular-nums text-foreground">{days(balance.usedDays)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground">Pending</dt>
          <dd className="font-semibold tabular-nums text-foreground">{days(pending)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground">Left after approval</dt>
          <dd
            className={
              afterApproval < 0
                ? 'font-semibold tabular-nums text-rose-800'
                : 'font-semibold tabular-nums text-foreground'
            }
          >
            {days(afterApproval)}
          </dd>
        </div>
      </dl>
      {afterApproval < 0 ? (
        <p className="flex items-start gap-1.5 text-[13px] font-medium text-rose-900" role="status">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Approving goes over the {request.leaveType.name.toLowerCase()} balance by{' '}
          {plural(Math.abs(afterApproval), 'day')}.
        </p>
      ) : null}
    </div>
  )
}

/* ---------- Pending request card ---------- */

export function PendingRequestCard({
  request,
  pendingRequests,
  note,
  onNoteChange,
  busy,
  onApprove,
  onReject,
}: {
  request: LeaveRequest
  pendingRequests: LeaveRequest[]
  note: string
  onNoteChange: (value: string) => void
  busy: boolean
  /**
   * Receives the shortfall in days when approving goes over the balance, or
   * null when the balance could not be read, so the page can ask before
   * approving blind. Approve waits while the balance is still loading.
   */
  onApprove: (shortfall: number | null) => void
  onReject: () => void
}) {
  const noteId = `decision-note-${request.id}`
  const view = useBalanceView(request, pendingRequests)
  const shortfall =
    view.kind === 'failed'
      ? null
      : view.kind === 'ready' && view.afterApproval < 0
        ? Math.abs(view.afterApproval)
        : 0
  const who = request.employee.fullName

  return (
    <RecordCard className="min-w-0 space-y-3">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground"><bdi>{request.employee.fullName}</bdi></p>
          <p className="text-[13px] text-muted-foreground">
            {request.leaveType.name} · {formatDayRange(request.startDate, request.endDate)}
          </p>
        </div>
        <StatusBadge tone="warning">{plural(request.totalDays, 'working day')}</StatusBadge>
      </div>

      {request.reason ? (
        <p className="text-sm leading-6 text-foreground">“{request.reason}”</p>
      ) : null}

      <LeaveBalanceSummary request={request} view={view} />

      <div className="space-y-2">
        <label htmlFor={noteId} className="sr-only">
          Decision note for {request.employee.fullName}
        </label>
        <Input
          id={noteId}
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="Decision note (optional)"
        />
        <div className="flex flex-wrap gap-2">
          <Button aria-label={`Approve ${who}'s leave`} type="button" disabled={busy || view.kind === 'loading'} onClick={() => onApprove(shortfall)}>
            Approve
          </Button>
          <Button aria-label={`Reject ${who}'s leave`} type="button" variant="outline" disabled={busy} onClick={onReject}>
            Reject
          </Button>
        </div>
      </div>
    </RecordCard>
  )
}

/* ---------- Leave types ---------- */

export function LeaveTypeList({
  leaveTypes,
  canManage,
  busy,
  onEdit,
  onDeactivate,
}: {
  leaveTypes: LeaveType[]
  canManage: boolean
  busy: boolean
  onEdit: (leaveType: LeaveType) => void
  onDeactivate: (leaveType: LeaveType) => void
}) {
  if (leaveTypes.length === 0) {
    return <p className="text-sm text-muted-foreground">No leave types yet.</p>
  }

  return (
    <ul className="divide-y divide-border/70">
      {leaveTypes.map((leaveType) => (
        <li key={leaveType.id} className="flex min-w-0 flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="font-semibold text-foreground">{leaveType.name}</p>
              {!leaveType.isActive ? <StatusBadge tone="neutral">Inactive</StatusBadge> : null}
            </div>
            <p className="text-[13px] text-muted-foreground">
              {plural(leaveType.defaultDays, 'day')} a year
              {leaveType.description ? ` · ${leaveType.description}` : ''}
            </p>
          </div>
          {canManage ? (
            <div className="flex shrink-0 gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onEdit(leaveType)}
                aria-label={`Edit ${leaveType.name}`}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Button>
              {leaveType.isActive ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => onDeactivate(leaveType)}
                  aria-label={`Deactivate ${leaveType.name}`}
                >
                  <XCircle className="mr-1.5 h-3.5 w-3.5" />
                  Deactivate
                </Button>
              ) : null}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

/* ---------- History ---------- */

export function LeaveHistoryTable({ requests }: { requests: LeaveRequest[] }) {
  return (
    <AdminTable caption="Leave request history" density="compact">
      <thead>
        <tr>
          <AdminTableHead>Employee</AdminTableHead>
          <AdminTableHead>Leave type</AdminTableHead>
          <AdminTableHead>Dates</AdminTableHead>
          <AdminTableHead numeric>Working days</AdminTableHead>
          <AdminTableHead>Status</AdminTableHead>
          <AdminTableHead>Reviewed by</AdminTableHead>
        </tr>
      </thead>
      <tbody>
        {requests.map((request) => (
          <AdminTableRow key={request.id}>
            <AdminTableCell nowrap>
              <div className="font-medium text-foreground"><bdi>{request.employee.fullName}</bdi></div>
              <div className="text-xs text-muted-foreground">{request.employee.employeeNumber}</div>
            </AdminTableCell>
            <AdminTableCell nowrap>{request.leaveType.name}</AdminTableCell>
            <AdminTableCell nowrap>{formatDayRange(request.startDate, request.endDate)}</AdminTableCell>
            <AdminTableCell numeric>{days(request.totalDays)}</AdminTableCell>
            <AdminTableCell nowrap>
              <StatusBadge tone={leaveStatusTone(request.status)} value={request.status} />
            </AdminTableCell>
            <AdminTableCell nowrap>
              {request.reviewedByName ? (
                <>
                  <div>{request.reviewedByName}</div>
                  {request.decidedAt ? (
                    <div className="text-xs text-muted-foreground">{formatDateTime(request.decidedAt)}</div>
                  ) : null}
                  {request.decisionNotes ? (
                    <div className="max-w-[260px] truncate text-xs text-muted-foreground" title={request.decisionNotes}>
                      “{request.decisionNotes}”
                    </div>
                  ) : null}
                </>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </AdminTableCell>
          </AdminTableRow>
        ))}
      </tbody>
    </AdminTable>
  )
}
