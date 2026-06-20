import { FormEvent, useState } from 'react'
import { gql, useMutation, useQuery } from '@apollo/client'
import { AdminHero } from '@/components/admin/admin-hero'
import { AdminTable, AdminTableEmpty, AdminTableRow } from '@/components/admin/admin-table'
import { PageFeedback } from '@/components/admin/page-feedback'
import { RecordCard } from '@/components/admin/record-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FormDrawer } from '@/components/ui/form-drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CalendarClock, FileCheck2, Pencil, PlaneTakeoff, Plus, XCircle } from 'lucide-react'
import { MetricCard } from '@/components/ui/metric-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { canManageAccounts, readStoredAdminAccount } from '@/lib/auth-session'

const LEAVE_PAGE_QUERY = gql`
  query LeavePageData {
    employees {
      id
      employeeNumber
      fullName
    }
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

const UPDATE_LEAVE_TYPE_MUTATION = gql`
  mutation UpdateLeaveType($input: UpdateLeaveTypeInput!) {
    updateLeaveType(input: $input) {
      id
    }
  }
`

const DEACTIVATE_LEAVE_TYPE_MUTATION = gql`
  mutation DeactivateLeaveType($input: DeactivateLeaveTypeInput!) {
    deactivateLeaveType(input: $input) {
      id
      isActive
    }
  }
`

const REQUEST_LEAVE_MUTATION = gql`
  mutation RequestLeave($input: RequestLeaveInput!) {
    requestLeave(input: $input) {
      id
      status
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

type LeaveRequestFormState = {
  employeeId: string
  leaveTypeId: string
  startDate: string
  endDate: string
  reason: string
}

const leaveTypeFormDefaults: LeaveTypeFormState = {
  code: '',
  name: '',
  defaultDays: '12',
  description: '',
}

const leaveRequestFormDefaults: LeaveRequestFormState = {
  employeeId: '',
  leaveTypeId: '',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  reason: '',
}

export function LeavePage() {
  const currentAdminAccount = readStoredAdminAccount()
  const canManageLeavePolicies = canManageAccounts(currentAdminAccount?.roles ?? [])
  const [leaveTypeForm, setLeaveTypeForm] = useState(leaveTypeFormDefaults)
  const [editingLeaveTypeId, setEditingLeaveTypeId] = useState<string | null>(null)
  const [leaveRequestForm, setLeaveRequestForm] = useState(leaveRequestFormDefaults)
  const [showLeaveTypeForm, setShowLeaveTypeForm] = useState(false)
  const [showLeaveRequestForm, setShowLeaveRequestForm] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})

  const { data, loading, error, refetch } = useQuery(LEAVE_PAGE_QUERY)
  const [createLeaveType, { loading: creatingLeaveType }] = useMutation(
    CREATE_LEAVE_TYPE_MUTATION
  )
  const [updateLeaveType, { loading: updatingLeaveType }] = useMutation(
    UPDATE_LEAVE_TYPE_MUTATION
  )
  const [deactivateLeaveType, { loading: deactivatingLeaveType }] = useMutation(
    DEACTIVATE_LEAVE_TYPE_MUTATION
  )
  const [requestLeave, { loading: requestingLeave }] = useMutation(
    REQUEST_LEAVE_MUTATION
  )
  const [reviewLeaveRequest, { loading: reviewingLeaveRequest }] = useMutation(
    REVIEW_LEAVE_REQUEST_MUTATION
  )

  const leaveTypes = data?.leaveTypes ?? []
  const employees = data?.employees ?? []
  const leaveRequests = data?.leaveRequests ?? []
  const pendingRequests = leaveRequests.filter(
    (request: { status: string }) => request.status === 'PENDING'
  )
  const approvedRequests = leaveRequests.filter(
    (request: { status: string }) => request.status === 'APPROVED'
  ).length

  const handleSaveLeaveType = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      const input = {
        code: leaveTypeForm.code,
        name: leaveTypeForm.name,
        defaultDays: Number.parseFloat(leaveTypeForm.defaultDays),
        description: leaveTypeForm.description || null,
      }

      if (editingLeaveTypeId) {
        await updateLeaveType({
          variables: {
            input: {
              id: editingLeaveTypeId,
              ...input,
            },
          },
        })
      } else {
        await createLeaveType({
          variables: {
            input,
          },
        })
      }
      setLeaveTypeForm(leaveTypeFormDefaults)
      setEditingLeaveTypeId(null)
      setShowLeaveTypeForm(false)
      setStatusMessage(editingLeaveTypeId ? 'Leave type updated.' : 'Leave type created.')
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to save leave type.'
      )
    }
  }

  const handleRequestLeave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await requestLeave({
        variables: {
          input: {
            employeeId: leaveRequestForm.employeeId,
            leaveTypeId: leaveRequestForm.leaveTypeId,
            startDate: leaveRequestForm.startDate,
            endDate: leaveRequestForm.endDate,
            reason: leaveRequestForm.reason,
          },
        },
      })
      setLeaveRequestForm(leaveRequestFormDefaults)
      setShowLeaveRequestForm(false)
      setStatusMessage('Leave request created.')
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to request leave.'
      )
    }
  }

  const handleEditLeaveType = (leaveType: {
    id: string
    code: string
    name: string
    defaultDays: number
    description?: string | null
  }) => {
    setEditingLeaveTypeId(leaveType.id)
    setLeaveTypeForm({
      code: leaveType.code,
      name: leaveType.name,
      defaultDays: String(leaveType.defaultDays),
      description: leaveType.description ?? '',
    })
    setErrorMessage(null)
    setStatusMessage(null)
    setShowLeaveTypeForm(true)
  }

  const handleCancelLeaveTypeEdit = () => {
    setEditingLeaveTypeId(null)
    setLeaveTypeForm(leaveTypeFormDefaults)
    setShowLeaveTypeForm(false)
  }

  const handleDeactivateLeaveType = async (leaveTypeId: string, name: string) => {
    if (!window.confirm(`Deactivate ${name}? New requests will stop using it.`)) {
      return
    }

    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await deactivateLeaveType({
        variables: {
          input: {
            id: leaveTypeId,
          },
        },
      })
      setStatusMessage('Leave type deactivated.')
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to deactivate leave type.'
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
      <AdminHero
        compact
        kicker="Leave control"
        title="Review requests quickly and keep policy simple."
        description="Pending decisions stay first, while leave types remain close by without crowding the page."
        actions={
          <>
            <Button type="button" onClick={() => setShowLeaveRequestForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New leave request
            </Button>
            {canManageLeavePolicies ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingLeaveTypeId(null)
                  setLeaveTypeForm(leaveTypeFormDefaults)
                  setShowLeaveTypeForm(true)
                }}
              >
                <PlaneTakeoff className="mr-2 h-4 w-4" />
                New leave type
              </Button>
            ) : null}
          </>
        }
      />

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

      <PageFeedback errorMessage={errorMessage} statusMessage={statusMessage} />

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
                  <RecordCard key={request.id}>
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
                  </RecordCard>
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
                  <RecordCard key={leaveType.id}>
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
                    {canManageLeavePolicies ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleEditLeaveType(leaveType)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={deactivatingLeaveType}
                          onClick={() =>
                            handleDeactivateLeaveType(leaveType.id, leaveType.name)
                          }
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Deactivate
                        </Button>
                      </div>
                    ) : null}
                  </RecordCard>
                )
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {canManageLeavePolicies ? (
        <FormDrawer
          open={showLeaveTypeForm}
          onOpenChange={(open) => {
            if (open) {
              setShowLeaveTypeForm(true)
            } else {
              handleCancelLeaveTypeEdit()
            }
          }}
          kicker="Leave policy"
          title={editingLeaveTypeId ? 'Edit leave type' : 'Create leave type'}
          description="Update leave policy without pushing the request queue down the page."
        >
          <form className="space-y-4" onSubmit={handleSaveLeaveType}>
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
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={creatingLeaveType || updatingLeaveType}>
                {creatingLeaveType || updatingLeaveType
                  ? 'Saving...'
                  : editingLeaveTypeId
                    ? 'Update Leave Type'
                    : 'Create Leave Type'}
              </Button>
              <Button type="button" variant="outline" onClick={handleCancelLeaveTypeEdit}>
                Cancel
              </Button>
            </div>
          </form>
        </FormDrawer>
      ) : null}

      <FormDrawer
        open={showLeaveRequestForm}
        onOpenChange={setShowLeaveRequestForm}
        kicker="Leave request"
        title="Create leave request"
        description="Create a request while keeping approvals and history in the workspace."
      >
        <form className="space-y-4" onSubmit={handleRequestLeave}>
          <div className="space-y-2">
            <Label htmlFor="leave-request-employee">Employee</Label>
            <select
              id="leave-request-employee"
              value={leaveRequestForm.employeeId}
              onChange={(event) =>
                setLeaveRequestForm((current) => ({
                  ...current,
                  employeeId: event.target.value,
                }))
              }
              required
            >
              <option value="">Select employee</option>
              {employees.map(
                (employee: { id: string; fullName: string; employeeNumber: string }) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.fullName} ({employee.employeeNumber})
                  </option>
                )
              )}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="leave-request-type">Leave Type</Label>
            <select
              id="leave-request-type"
              value={leaveRequestForm.leaveTypeId}
              onChange={(event) =>
                setLeaveRequestForm((current) => ({
                  ...current,
                  leaveTypeId: event.target.value,
                }))
              }
              required
            >
              <option value="">Select type</option>
              {leaveTypes.map((leaveType: { id: string; name: string; code: string }) => (
                <option key={leaveType.id} value={leaveType.id}>
                  {leaveType.name} ({leaveType.code})
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="leave-request-start">Start</Label>
              <Input
                id="leave-request-start"
                type="date"
                value={leaveRequestForm.startDate}
                onChange={(event) =>
                  setLeaveRequestForm((current) => ({
                    ...current,
                    startDate: event.target.value,
                  }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="leave-request-end">End</Label>
              <Input
                id="leave-request-end"
                type="date"
                value={leaveRequestForm.endDate}
                onChange={(event) =>
                  setLeaveRequestForm((current) => ({
                    ...current,
                    endDate: event.target.value,
                  }))
                }
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="leave-request-reason">Reason</Label>
            <Input
              id="leave-request-reason"
              value={leaveRequestForm.reason}
              onChange={(event) =>
                setLeaveRequestForm((current) => ({
                  ...current,
                  reason: event.target.value,
                }))
              }
              required
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={requestingLeave || employees.length === 0 || leaveTypes.length === 0}
            >
              {requestingLeave ? 'Saving...' : 'Create Request'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowLeaveRequestForm(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </FormDrawer>

      <Card>
        <CardHeader>
          <p className="app-kicker">History</p>
          <CardTitle>Request History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading request history...</p>
          ) : leaveRequests.length === 0 ? (
            <AdminTableEmpty>No leave requests found yet.</AdminTableEmpty>
          ) : (
            <AdminTable>
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
                      <AdminTableRow key={request.id}>
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
                      </AdminTableRow>
                    )
                  )}
                </tbody>
            </AdminTable>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
