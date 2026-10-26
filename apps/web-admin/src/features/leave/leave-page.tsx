import { useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@apollo/client'
import { PlaneTakeoff, Plus } from 'lucide-react'

import { AdminHero } from '@/components/admin/admin-hero'
import { AdminTableEmpty } from '@/components/admin/admin-table'
import { PageFeedback } from '@/components/admin/page-feedback'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FormDrawer } from '@/components/ui/form-drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MetricCard } from '@/components/ui/metric-card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { canManageAccounts, useAdminSession } from '@/lib/auth-session'
import { todayLocal } from '@/lib/format'
import { readableError } from '@/lib/graphql-errors'

import { LeaveHistoryTable, LeaveTypeList, PendingRequestCard } from './components'
import {
  CREATE_LEAVE_TYPE_MUTATION,
  DEACTIVATE_LEAVE_TYPE_MUTATION,
  LEAVE_PAGE_QUERY,
  REQUEST_LEAVE_MUTATION,
  REVIEW_LEAVE_REQUEST_MUTATION,
  UPDATE_LEAVE_TYPE_MUTATION,
  type LeaveEmployee,
  type LeaveRequest,
  type LeaveType,
} from './graphql'

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

function leaveRequestDefaults(): LeaveRequestFormState {
  const today = todayLocal()
  return { employeeId: '', leaveTypeId: '', startDate: today, endDate: today, reason: '' }
}

type LeavePageData = {
  employees: LeaveEmployee[]
  leaveTypes: LeaveType[]
  leaveRequests: LeaveRequest[]
}

export function LeavePage() {
  const { account } = useAdminSession()
  const canManageLeavePolicies = canManageAccounts(account)
  const [leaveTypeForm, setLeaveTypeForm] = useState(leaveTypeFormDefaults)
  const [editingLeaveTypeId, setEditingLeaveTypeId] = useState<string | null>(null)
  const [leaveRequestForm, setLeaveRequestForm] = useState(leaveRequestDefaults)
  const [showLeaveTypeForm, setShowLeaveTypeForm] = useState(false)
  const [showLeaveRequestForm, setShowLeaveRequestForm] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const [deactivating, setDeactivating] = useState<LeaveType | null>(null)

  const { data, loading, error, refetch } = useQuery<LeavePageData>(LEAVE_PAGE_QUERY)
  const [createLeaveType, { loading: creatingLeaveType }] = useMutation(CREATE_LEAVE_TYPE_MUTATION)
  const [updateLeaveType, { loading: updatingLeaveType }] = useMutation(UPDATE_LEAVE_TYPE_MUTATION)
  const [deactivateLeaveType, { loading: deactivatingLeaveType }] = useMutation(DEACTIVATE_LEAVE_TYPE_MUTATION)
  const [requestLeave, { loading: requestingLeave }] = useMutation(REQUEST_LEAVE_MUTATION)
  const [reviewLeaveRequest, { loading: reviewingLeaveRequest }] = useMutation(REVIEW_LEAVE_REQUEST_MUTATION)

  const leaveTypes = data?.leaveTypes ?? []
  const activeLeaveTypes = leaveTypes.filter((leaveType) => leaveType.isActive)
  const employees = data?.employees ?? []
  const leaveRequests = data?.leaveRequests ?? []
  const pendingRequests = leaveRequests.filter((request) => request.status === 'PENDING')
  const approvedCount = leaveRequests.filter((request) => request.status === 'APPROVED').length

  const resetFeedback = () => {
    setErrorMessage(null)
    setStatusMessage(null)
  }

  const handleSaveLeaveType = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetFeedback()
    try {
      const input = {
        code: leaveTypeForm.code.trim(),
        name: leaveTypeForm.name.trim(),
        defaultDays: Number.parseFloat(leaveTypeForm.defaultDays),
        description: leaveTypeForm.description.trim() || null,
      }
      if (editingLeaveTypeId) {
        await updateLeaveType({ variables: { input: { id: editingLeaveTypeId, ...input } } })
      } else {
        await createLeaveType({ variables: { input } })
      }
      setStatusMessage(editingLeaveTypeId ? 'Leave type updated.' : 'Leave type created.')
      setLeaveTypeForm(leaveTypeFormDefaults)
      setEditingLeaveTypeId(null)
      setShowLeaveTypeForm(false)
      await refetch()
    } catch (mutationError) {
      setErrorMessage(readableError(mutationError, 'Could not save the leave type.'))
    }
  }

  const handleRequestLeave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetFeedback()
    try {
      await requestLeave({
        variables: {
          input: {
            employeeId: leaveRequestForm.employeeId,
            leaveTypeId: leaveRequestForm.leaveTypeId,
            startDate: leaveRequestForm.startDate,
            endDate: leaveRequestForm.endDate,
            reason: leaveRequestForm.reason.trim(),
          },
        },
      })
      setLeaveRequestForm(leaveRequestDefaults())
      setShowLeaveRequestForm(false)
      setStatusMessage('Leave request created.')
      await refetch()
    } catch (mutationError) {
      setErrorMessage(readableError(mutationError, 'Could not create the leave request.'))
    }
  }

  const handleEditLeaveType = (leaveType: LeaveType) => {
    setEditingLeaveTypeId(leaveType.id)
    setLeaveTypeForm({
      code: leaveType.code,
      name: leaveType.name,
      defaultDays: String(leaveType.defaultDays),
      description: leaveType.description ?? '',
    })
    resetFeedback()
    setShowLeaveTypeForm(true)
  }

  const handleCancelLeaveTypeEdit = () => {
    setEditingLeaveTypeId(null)
    setLeaveTypeForm(leaveTypeFormDefaults)
    setShowLeaveTypeForm(false)
  }

  const handleDeactivateLeaveType = async () => {
    if (!deactivating) return
    resetFeedback()
    try {
      await deactivateLeaveType({ variables: { input: { id: deactivating.id } } })
      setStatusMessage(`${deactivating.name} deactivated.`)
      setDeactivating(null)
      await refetch()
    } catch (mutationError) {
      setDeactivating(null)
      setErrorMessage(readableError(mutationError, 'Could not deactivate the leave type.'))
    }
  }

  const handleReview = async (request: LeaveRequest, status: 'APPROVED' | 'REJECTED') => {
    resetFeedback()
    try {
      await reviewLeaveRequest({
        variables: {
          input: {
            requestId: request.id,
            status,
            decisionNotes: reviewNotes[request.id]?.trim() || null,
          },
        },
      })
      setReviewNotes((current) => ({ ...current, [request.id]: '' }))
      setStatusMessage(
        `${request.employee.fullName}'s ${request.leaveType.name.toLowerCase()} ${
          status === 'APPROVED' ? 'approved' : 'rejected'
        }.`,
      )
      await refetch()
    } catch (mutationError) {
      setErrorMessage(readableError(mutationError, 'Could not review the leave request.'))
    }
  }

  return (
    <div className="min-w-0 space-y-4">
      <AdminHero
        title="Leave"
        description="Review pending requests with each person's balance in view."
        actions={
          <>
            <Button type="button" onClick={() => setShowLeaveRequestForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New request
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

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Pending"
          value={String(pendingRequests.length)}
          detail={pendingRequests.length === 0 ? 'Nothing to review' : 'Waiting for review'}
        />
        <MetricCard
          label="Leave types"
          value={String(activeLeaveTypes.length)}
          detail={
            leaveTypes.length > activeLeaveTypes.length
              ? `Active · ${leaveTypes.length - activeLeaveTypes.length} inactive`
              : 'Active and available to request'
          }
        />
        <MetricCard label="Approved" value={String(approvedCount)} detail="Approved requests on record" />
      </div>

      <PageFeedback errorMessage={errorMessage} statusMessage={statusMessage} />

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <CardTitle>Pending requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && !data ? (
              <p className="text-sm text-muted-foreground">Loading leave requests…</p>
            ) : error && !data ? (
              <PageFeedback loadError={error} loadErrorPrefix="Leave requests could not be loaded." />
            ) : pendingRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending leave requests right now.</p>
            ) : (
              pendingRequests.map((request) => (
                <PendingRequestCard
                  key={request.id}
                  request={request}
                  pendingRequests={pendingRequests}
                  note={reviewNotes[request.id] ?? ''}
                  onNoteChange={(value) =>
                    setReviewNotes((current) => ({ ...current, [request.id]: value }))
                  }
                  busy={reviewingLeaveRequest}
                  onApprove={() => handleReview(request, 'APPROVED')}
                  onReject={() => handleReview(request, 'REJECTED')}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 self-start">
          <CardHeader className="pb-1">
            <CardTitle>Leave types</CardTitle>
          </CardHeader>
          <CardContent>
            <LeaveTypeList
              leaveTypes={leaveTypes}
              canManage={canManageLeavePolicies}
              busy={deactivatingLeaveType}
              onEdit={handleEditLeaveType}
              onDeactivate={setDeactivating}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0">
        <CardHeader className="pb-3">
          <CardTitle>Request history</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <p className="text-sm text-muted-foreground">Loading request history…</p>
          ) : leaveRequests.length === 0 ? (
            <AdminTableEmpty>No leave requests yet.</AdminTableEmpty>
          ) : (
            <LeaveHistoryTable requests={leaveRequests} />
          )}
        </CardContent>
      </Card>

      {canManageLeavePolicies ? (
        <FormDrawer
          open={showLeaveTypeForm}
          onOpenChange={(open) => (open ? setShowLeaveTypeForm(true) : handleCancelLeaveTypeEdit())}
          title={editingLeaveTypeId ? 'Edit leave type' : 'New leave type'}
          description="Set the yearly allowance employees can request."
        >
          <form className="space-y-4" onSubmit={handleSaveLeaveType}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="leave-type-name">Name</Label>
                <Input
                  id="leave-type-name"
                  value={leaveTypeForm.name}
                  onChange={(event) => setLeaveTypeForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Maternity leave"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="leave-type-code">Short code</Label>
                <Input
                  id="leave-type-code"
                  value={leaveTypeForm.code}
                  onChange={(event) =>
                    setLeaveTypeForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))
                  }
                  placeholder="MATERNITY"
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="leave-type-days">Days per year</Label>
                <Input
                  id="leave-type-days"
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="0.5"
                  value={leaveTypeForm.defaultDays}
                  onChange={(event) =>
                    setLeaveTypeForm((current) => ({ ...current, defaultDays: event.target.value }))
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
                    setLeaveTypeForm((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={creatingLeaveType || updatingLeaveType}>
                {creatingLeaveType || updatingLeaveType
                  ? 'Saving…'
                  : editingLeaveTypeId
                    ? 'Save changes'
                    : 'Create leave type'}
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
        title="New leave request"
        description="Record leave on behalf of an employee. Only working days are counted."
      >
        <form className="space-y-4" onSubmit={handleRequestLeave}>
          <div className="space-y-2">
            <Label htmlFor="leave-request-employee">Employee</Label>
            <Select
              name="leave-request-employee"
              value={leaveRequestForm.employeeId}
              onValueChange={(employeeId) => setLeaveRequestForm((current) => ({ ...current, employeeId }))}
              required
            >
              <SelectTrigger id="leave-request-employee">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.fullName} ({employee.employeeNumber})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="leave-request-type">Leave type</Label>
            <Select
              name="leave-request-type"
              value={leaveRequestForm.leaveTypeId}
              onValueChange={(leaveTypeId) => setLeaveRequestForm((current) => ({ ...current, leaveTypeId }))}
              required
            >
              <SelectTrigger id="leave-request-type">
                <SelectValue placeholder="Select leave type" />
              </SelectTrigger>
              <SelectContent>
                {activeLeaveTypes.map((leaveType) => (
                  <SelectItem key={leaveType.id} value={leaveType.id}>
                    {leaveType.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="leave-request-start">First day</Label>
              <Input
                id="leave-request-start"
                type="date"
                value={leaveRequestForm.startDate}
                onChange={(event) =>
                  setLeaveRequestForm((current) => ({
                    ...current,
                    startDate: event.target.value,
                    endDate: current.endDate < event.target.value ? event.target.value : current.endDate,
                  }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="leave-request-end">Last day</Label>
              <Input
                id="leave-request-end"
                type="date"
                min={leaveRequestForm.startDate}
                value={leaveRequestForm.endDate}
                onChange={(event) => setLeaveRequestForm((current) => ({ ...current, endDate: event.target.value }))}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="leave-request-reason">Reason</Label>
            <Input
              id="leave-request-reason"
              value={leaveRequestForm.reason}
              onChange={(event) => setLeaveRequestForm((current) => ({ ...current, reason: event.target.value }))}
              required
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={requestingLeave || employees.length === 0 || activeLeaveTypes.length === 0}
            >
              {requestingLeave ? 'Saving…' : 'Create request'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowLeaveRequestForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </FormDrawer>

      <ConfirmDialog
        open={Boolean(deactivating)}
        onOpenChange={(open) => (open ? undefined : setDeactivating(null))}
        title={deactivating ? `Deactivate ${deactivating.name}?` : 'Deactivate leave type?'}
        description="Employees can no longer request it. Existing requests and history stay as they are."
        confirmLabel="Deactivate"
        tone="destructive"
        busy={deactivatingLeaveType}
        onConfirm={handleDeactivateLeaveType}
      />
    </div>
  )
}
