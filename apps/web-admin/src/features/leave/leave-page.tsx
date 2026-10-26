import { useMemo, useState, type FormEvent } from 'react'
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
import { Notice } from '@/components/ui/notice'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/lib/toast'
import { FilterSelect } from '@/features/shared/controls'
import { ListToolbar } from '@/features/shared/list-toolbar'
import { matchesSearch, useShowMore } from '@/features/shared/use-show-more'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { canManageAccounts, useAdminSession } from '@/lib/auth-session'
import { formatDayRange, formatStatus, plural, todayLocal } from '@/lib/format'
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
  const [leaveTypeError, setLeaveTypeError] = useState<string | null>(null)
  const [leaveRequestError, setLeaveRequestError] = useState<string | null>(null)
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const [deactivating, setDeactivating] = useState<LeaveType | null>(null)
  const [rejecting, setRejecting] = useState<LeaveRequest | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectTouched, setRejectTouched] = useState(false)
  // shortfall null: the balance could not be loaded, so the over-balance check is unknown.
  const [approvingOver, setApprovingOver] = useState<{ request: LeaveRequest; shortfall: number | null } | null>(null)
  const [rejectError, setRejectError] = useState<string | null>(null)
  const [historySearch, setHistorySearch] = useState('')
  const [historyStatus, setHistoryStatus] = useState('')

  const { data, loading, error, refetch } = useQuery<LeavePageData>(LEAVE_PAGE_QUERY)
  const [createLeaveType, { loading: creatingLeaveType }] = useMutation(CREATE_LEAVE_TYPE_MUTATION)
  const [updateLeaveType, { loading: updatingLeaveType }] = useMutation(UPDATE_LEAVE_TYPE_MUTATION)
  const [deactivateLeaveType, { loading: deactivatingLeaveType }] = useMutation(DEACTIVATE_LEAVE_TYPE_MUTATION)
  const [requestLeave, { loading: requestingLeave }] = useMutation(REQUEST_LEAVE_MUTATION)
  const [reviewLeaveRequest, { loading: reviewingLeaveRequest }] = useMutation(REVIEW_LEAVE_REQUEST_MUTATION)

  const leaveTypes = data?.leaveTypes ?? []
  const activeLeaveTypes = leaveTypes.filter((leaveType) => leaveType.isActive)
  const employees = data?.employees ?? []
  const leaveRequests = useMemo(() => data?.leaveRequests ?? [], [data?.leaveRequests])
  // Soonest first day first: those are the decisions that cannot wait.
  const pendingRequests = useMemo(
    () =>
      leaveRequests
        .filter((request) => request.status === 'PENDING')
        .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [leaveRequests],
  )
  const approvedCount = leaveRequests.filter((request) => request.status === 'APPROVED').length
  const historyStatusOptions = useMemo(
    () =>
      [...new Set(leaveRequests.map((request) => request.status))]
        .sort()
        .map((status) => ({ value: status, label: formatStatus(status) })),
    [leaveRequests],
  )
  const filteredHistory = useMemo(
    () =>
      leaveRequests.filter(
        (request) =>
          (!historyStatus || request.status === historyStatus) &&
          matchesSearch(historySearch, [
            request.employee.fullName,
            request.employee.employeeNumber,
            request.leaveType.name,
          ]),
      ),
    [leaveRequests, historySearch, historyStatus],
  )
  const history = useShowMore(filteredHistory)

  const handleSaveLeaveType = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLeaveTypeError(null)
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
      toast.success(editingLeaveTypeId ? `${input.name} updated.` : `${input.name} created.`)
      setLeaveTypeForm(leaveTypeFormDefaults)
      setEditingLeaveTypeId(null)
      setShowLeaveTypeForm(false)
      await refetch()
    } catch (mutationError) {
      setLeaveTypeError(readableError(mutationError, 'Could not save the leave type.'))
    }
  }

  const handleRequestLeave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLeaveRequestError(null)
    const missing = !leaveRequestForm.employeeId
      ? 'Choose the employee taking leave.'
      : !leaveRequestForm.leaveTypeId
        ? 'Choose a leave type.'
        : !leaveRequestForm.reason.trim()
          ? 'Add a short reason.'
          : null
    if (missing) {
      setLeaveRequestError(missing)
      return
    }
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
      const person = employees.find((employee) => employee.id === leaveRequestForm.employeeId)
      toast.success(`Leave request created${person ? ` for ${person.fullName}` : ''}. It is waiting for review.`)
      await refetch()
    } catch (mutationError) {
      setLeaveRequestError(readableError(mutationError, 'Could not create the leave request.'))
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
    setLeaveTypeError(null)
    setShowLeaveTypeForm(true)
  }

  const handleCancelLeaveTypeEdit = () => {
    setEditingLeaveTypeId(null)
    setLeaveTypeForm(leaveTypeFormDefaults)
    setLeaveTypeError(null)
    setShowLeaveTypeForm(false)
  }

  const handleDeactivateLeaveType = async () => {
    if (!deactivating) return
    try {
      await deactivateLeaveType({ variables: { input: { id: deactivating.id } } })
      toast.success(`${deactivating.name} deactivated.`)
      setDeactivating(null)
      await refetch()
    } catch (mutationError) {
      setDeactivating(null)
      toast.error(readableError(mutationError, 'Could not deactivate the leave type.'))
    }
  }

  const handleReview = async (
    request: LeaveRequest,
    status: 'APPROVED' | 'REJECTED',
    notes = reviewNotes[request.id]?.trim() || null,
    reportError: (message: string) => void = (message) => toast.error(message),
  ) => {
    try {
      await reviewLeaveRequest({
        variables: { input: { requestId: request.id, status, decisionNotes: notes } },
      })
      setReviewNotes((current) => ({ ...current, [request.id]: '' }))
      toast.success(
        `${request.employee.fullName}'s ${request.leaveType.name.toLowerCase()} ${
          status === 'APPROVED' ? 'approved' : 'rejected'
        }.`,
      )
      await refetch()
      return true
    } catch (mutationError) {
      reportError(readableError(mutationError, 'Could not review the leave request.'))
      return false
    }
  }

  const openReject = (request: LeaveRequest) => {
    setRejectReason(reviewNotes[request.id] ?? '')
    setRejectTouched(false)
    setRejectError(null)
    setRejecting(request)
  }

  const confirmReject = async () => {
    if (!rejecting) return
    setRejectTouched(true)
    if (!rejectReason.trim()) return
    setRejectError(null)
    // A failure stays inside the dialog, next to the reason, where the user is looking.
    const ok = await handleReview(rejecting, 'REJECTED', rejectReason.trim(), setRejectError)
    if (ok) setRejecting(null)
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

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
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
              <p className="text-sm text-muted-foreground">Nothing to review. New requests appear here, soonest first.</p>
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
                  onApprove={(shortfall) =>
                    shortfall === null || shortfall > 0
                      ? setApprovingOver({ request, shortfall })
                      : void handleReview(request, 'APPROVED')
                  }
                  onReject={() => openReject(request)}
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
            <div className="space-y-3">
              <ListToolbar
                filters={
                  <FilterSelect
                    allLabel="Any status"
                    className="w-full sm:w-44"
                    id="leave-history-status"
                    label="Status"
                    onChange={(value) => {
                      setHistoryStatus(value)
                      history.reset()
                    }}
                    options={historyStatusOptions}
                    value={historyStatus}
                  />
                }
                noun={['request']}
                onClear={() => {
                  setHistorySearch('')
                  setHistoryStatus('')
                }}
                onSearchChange={(value) => {
                  setHistorySearch(value)
                  history.reset()
                }}
                search={historySearch}
                searchLabel="Search leave history"
                searchPlaceholder="Search name, number or leave type"
                shown={filteredHistory.length}
                total={leaveRequests.length}
              />
              {filteredHistory.length === 0 ? (
                <AdminTableEmpty>No requests match. Try another name or clear the filters.</AdminTableEmpty>
              ) : (
                <>
                  <LeaveHistoryTable requests={history.visible} />
                  {history.more}
                </>
              )}
            </div>
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
            {leaveTypeError ? (
              <Notice role="alert" tone="danger">
                {leaveTypeError}
              </Notice>
            ) : null}
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
        onOpenChange={(open) => {
          setShowLeaveRequestForm(open)
          if (!open) setLeaveRequestError(null)
        }}
        title="New leave request"
        description="Record leave on behalf of an employee. Only working days are counted."
      >
        <form className="space-y-4" noValidate onSubmit={handleRequestLeave}>
          {leaveRequestError ? (
            <Notice role="alert" tone="danger">
              {leaveRequestError}
            </Notice>
          ) : null}
          {employees.length === 0 || activeLeaveTypes.length === 0 ? (
            <Notice tone="warning">
              {employees.length === 0
                ? 'Add an employee in People before recording leave.'
                : 'Create a leave type first.'}
            </Notice>
          ) : null}
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
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowLeaveRequestForm(false)
                setLeaveRequestError(null)
              }}
            >
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

      <ConfirmDialog
        open={Boolean(rejecting)}
        onOpenChange={(open) => (open ? undefined : setRejecting(null))}
        title={rejecting ? `Reject ${rejecting.employee.fullName}'s leave?` : 'Reject leave?'}
        description={
          rejecting
            ? `${rejecting.leaveType.name} · ${formatDayRange(rejecting.startDate, rejecting.endDate)} · ${plural(rejecting.totalDays, 'working day')}. The employee sees your reason.`
            : undefined
        }
        confirmLabel="Reject request"
        tone="destructive"
        busy={reviewingLeaveRequest}
        onConfirm={confirmReject}
      >
        <div className="space-y-1.5">
          <Label htmlFor="leave-reject-reason">Reason for the employee</Label>
          <Textarea
            aria-describedby={
              [rejectTouched && !rejectReason.trim() ? 'leave-reject-reason-error' : null, rejectError ? 'leave-reject-failure' : null]
                .filter(Boolean)
                .join(' ') || undefined
            }
            aria-invalid={rejectTouched && !rejectReason.trim() ? true : undefined}
            className="min-h-[5.5rem]"
            id="leave-reject-reason"
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="For example: peak season, please pick dates after the 20th"
            rows={3}
            value={rejectReason}
          />
          {rejectTouched && !rejectReason.trim() ? (
            <p className="text-[13px] font-medium text-rose-800" id="leave-reject-reason-error">
              Add a reason so the employee knows what to change.
            </p>
          ) : null}
          {rejectError ? (
            <p className="text-[13px] font-medium text-rose-800" id="leave-reject-failure" role="alert">
              {rejectError}
            </p>
          ) : null}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(approvingOver)}
        onOpenChange={(open) => (open ? undefined : setApprovingOver(null))}
        title={
          !approvingOver
            ? 'Approve beyond balance?'
            : approvingOver.shortfall === null
              ? `Approve ${approvingOver.request.employee.fullName}'s leave without a balance check?`
              : `Approve beyond ${approvingOver.request.employee.fullName}'s balance?`
        }
        description={
          !approvingOver
            ? undefined
            : approvingOver.shortfall === null
              ? `Their ${approvingOver.request.leaveType.name.toLowerCase()} balance could not be checked, so this may go over the allowance.`
              : `This goes over the ${approvingOver.request.leaveType.name.toLowerCase()} allowance by ${plural(approvingOver.shortfall, 'day')}.`
        }
        confirmLabel="Approve anyway"
        busy={reviewingLeaveRequest}
        onConfirm={async () => {
          if (!approvingOver) return
          await handleReview(approvingOver.request, 'APPROVED')
          setApprovingOver(null)
        }}
      />
    </div>
  )
}
