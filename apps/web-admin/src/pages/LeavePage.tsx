import { FormEvent, useState } from 'react'
import { gql, useMutation, useQuery } from '@apollo/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CalendarClock, FileCheck2, PlaneTakeoff } from 'lucide-react'
import { MetricCard } from '@/components/ui/metric-card'
import { Notice } from '@/components/ui/notice'
import { StatusBadge } from '@/components/ui/status-badge'
import { canManageAccounts, readStoredAdminAccount } from '@/lib/auth-session'

const LEAVE_PAGE_QUERY = gql`
  query LeavePageData {
    leaveTypes {
      id
      code
      name
      defaultDays
      description
      isActive
    }
    leaveRequests {
      id
      startDate
      endDate
      totalDays
      status
      reason
      requestedAt
      decidedAt
      reviewedByName
      decisionNotes
      employee {
        id
        employeeNumber
        fullName
      }
      leaveType {
        id
        code
        name
      }
    }
  }
`

const CREATE_LEAVE_TYPE_MUTATION = gql`
  mutation CreateLeaveType($input: CreateLeaveTypeInput!) {
    createLeaveType(input: $input) {
      id
    }
  }
`

const REVIEW_LEAVE_REQUEST_MUTATION = gql`
  mutation ReviewLeaveRequest($input: ReviewLeaveRequestInput!) {
    reviewLeaveRequest(input: $input) {
      id
      status
    }
  }
`

type LeaveTypeFormState = {
  code: string
  name: string
  defaultDays: string
  description: string
}

const leaveTypeFormDefaults: LeaveTypeFormState = {
  code: '',
  name: '',
  defaultDays: '12',
  description: '',
}

export function LeavePage() {
  const currentAdminAccount = readStoredAdminAccount()
  const canManageLeavePolicies = canManageAccounts(currentAdminAccount?.roles ?? [])
  const [leaveTypeForm, setLeaveTypeForm] = useState(leaveTypeFormDefaults)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})

  const { data, loading, error, refetch } = useQuery(LEAVE_PAGE_QUERY)
  const [createLeaveType, { loading: creatingLeaveType }] = useMutation(
    CREATE_LEAVE_TYPE_MUTATION
  )
  const [reviewLeaveRequest, { loading: reviewingLeaveRequest }] = useMutation(
    REVIEW_LEAVE_REQUEST_MUTATION
  )

  const leaveTypes = data?.leaveTypes ?? []
  const leaveRequests = data?.leaveRequests ?? []
  const pendingRequests = leaveRequests.filter(
    (request: { status: string }) => request.status === 'PENDING'
  )
  const approvedRequests = leaveRequests.filter(
    (request: { status: string }) => request.status === 'APPROVED'
  ).length

  const handleCreateLeaveType = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await createLeaveType({
        variables: {
          input: {
            code: leaveTypeForm.code,
            name: leaveTypeForm.name,
            defaultDays: Number.parseFloat(leaveTypeForm.defaultDays),
            description: leaveTypeForm.description || null,
          },
        },
      })
      setLeaveTypeForm(leaveTypeFormDefaults)
      setStatusMessage('Leave type created.')
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to create leave type.'
      )
    }
  }

  const handleReviewLeaveRequest = async (requestId: string, status: 'APPROVED' | 'REJECTED') => {
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await reviewLeaveRequest({
        variables: {
          input: {
            requestId,
            status,
            decisionNotes: reviewNotes[requestId]?.trim() || null,
          },
        },
      })
      setReviewNotes((current) => ({
        ...current,
        [requestId]: '',
      }))
      setStatusMessage(`Leave request ${status.toLowerCase()}.`)
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to review leave request.'
      )
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5 sm:p-6">
          <p className="app-kicker">Leave control</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
            Review requests quickly and keep policy simple.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Pending decisions stay first, while leave types remain close by without crowding the page.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          detail="Awaiting manager action"
          icon={CalendarClock}
          label="Pending"
          tone="bg-amber-100 text-amber-800"
          value={String(pendingRequests.length)}
        />
        <MetricCard
          detail="Configured leave types"
          icon={PlaneTakeoff}
          label="Policies"
          tone="bg-sky-100 text-sky-800"
          value={String(leaveTypes.length)}
        />
        <MetricCard
          detail="Approved requests in history"
          icon={FileCheck2}
          label="Approved"
          tone="bg-emerald-100 text-emerald-800"
          value={String(approvedRequests)}
        />
      </div>

      {errorMessage ? <Notice tone="danger">{errorMessage}</Notice> : null}
      {statusMessage ? <Notice tone="success">{statusMessage}</Notice> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <p className="app-kicker">Approvals</p>
            <CardTitle>Pending Requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading leave requests...</p>
            ) : error ? (
              <p className="text-sm text-red-600">
                Unable to load leave requests. {error.message}
              </p>
            ) : pendingRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No pending leave requests right now.
              </p>
            ) : (
              pendingRequests.map(
                (request: {
                  id: string
                  startDate: string
                  endDate: string
                  totalDays: number
                  reason: string
                  employee: { fullName: string; employeeNumber: string }
                  leaveType: { name: string }
                }) => (
                  <div key={request.id} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">{request.employee.fullName}</p>
                        <p className="text-sm text-muted-foreground">
                          {request.employee.employeeNumber} • {request.leaveType.name}
                        </p>
                      </div>
                      <StatusBadge tone="warning">Pending</StatusBadge>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {request.startDate} to {request.endDate} • {request.totalDays} day(s)
                    </p>
                    <p className="mt-2 text-sm">{request.reason}</p>
                    <div className="mt-4 space-y-3">
                      <Input
                        value={reviewNotes[request.id] ?? ''}
                        onChange={(event) =>
                          setReviewNotes((current) => ({
                            ...current,
                            [request.id]: event.target.value,
                          }))
                        }
                        placeholder="Optional decision note"
                      />
                      <div className="flex gap-3">
                        <Button
                          type="button"
                          disabled={reviewingLeaveRequest}
                          onClick={() => handleReviewLeaveRequest(request.id, 'APPROVED')}
                        >
                          Approve
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={reviewingLeaveRequest}
                          onClick={() => handleReviewLeaveRequest(request.id, 'REJECTED')}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              )
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="app-kicker">Policy</p>
            <CardTitle>Leave Types</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {leaveTypes.map(
                (leaveType: {
                  id: string
                  code: string
                  name: string
                  defaultDays: number
                  description?: string | null
                }) => (
                  <div key={leaveType.id} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{leaveType.name}</p>
                        <p className="text-sm text-muted-foreground">{leaveType.code}</p>
                      </div>
                      <StatusBadge tone="info">
                        {leaveType.defaultDays} days
                      </StatusBadge>
                    </div>
                    {leaveType.description && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {leaveType.description}
                      </p>
                    )}
                  </div>
                )
              )}
            </div>

            {canManageLeavePolicies && (
              <form className="space-y-4 border-t pt-4" onSubmit={handleCreateLeaveType}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="leave-type-code">Code</Label>
                    <Input
                      id="leave-type-code"
                      value={leaveTypeForm.code}
                      onChange={(event) =>
                        setLeaveTypeForm((current) => ({
                          ...current,
                          code: event.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="MATERNITY"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="leave-type-name">Name</Label>
                    <Input
                      id="leave-type-name"
                      value={leaveTypeForm.name}
                      onChange={(event) =>
                        setLeaveTypeForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      placeholder="Maternity Leave"
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="leave-type-days">Default Days</Label>
                    <Input
                      id="leave-type-days"
                      type="number"
                      min="1"
                      step="0.5"
                      value={leaveTypeForm.defaultDays}
                      onChange={(event) =>
                        setLeaveTypeForm((current) => ({
                          ...current,
                          defaultDays: event.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="leave-type-description">Description</Label>
                    <Input
                      id="leave-type-description"
                      value={leaveTypeForm.description}
                      onChange={(event) =>
                        setLeaveTypeForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <Button type="submit" disabled={creatingLeaveType}>
                  {creatingLeaveType ? 'Saving...' : 'Create Leave Type'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <p className="app-kicker">History</p>
          <CardTitle>Request History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading request history...</p>
          ) : leaveRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leave requests found yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left">Employee</th>
                    <th className="px-4 py-3 text-left">Leave Type</th>
                    <th className="px-4 py-3 text-left">Dates</th>
                    <th className="px-4 py-3 text-left">Days</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Reviewed By</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveRequests.map(
                    (request: {
                      id: string
                      startDate: string
                      endDate: string
                      totalDays: number
                      status: string
                      reviewedByName?: string | null
                      employee: { fullName: string; employeeNumber: string }
                      leaveType: { name: string }
                    }) => (
                      <tr key={request.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3">
                          {request.employee.fullName}
                          <div className="text-xs text-muted-foreground">
                            {request.employee.employeeNumber}
                          </div>
                        </td>
                        <td className="px-4 py-3">{request.leaveType.name}</td>
                        <td className="px-4 py-3">
                          {request.startDate} to {request.endDate}
                        </td>
                        <td className="px-4 py-3">{request.totalDays}</td>
                        <td className="px-4 py-3">
                          <StatusBadge
                            tone={
                              request.status === 'APPROVED'
                                ? 'success'
                                : request.status === 'REJECTED'
                                  ? 'danger'
                                  : 'warning'
                            }
                          >
                            {request.status}
                          </StatusBadge>
                        </td>
                        <td className="px-4 py-3">{request.reviewedByName || '—'}</td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
