import { Briefcase, CheckCircle2, Plus, Search, UserRoundPlus } from 'lucide-react'
import { FormEvent, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { MetricCard } from '@/components/ui/metric-card'
import { Notice } from '@/components/ui/notice'
import { useConfirm } from '@/features/shared/confirm-dialog'
import { FilterSelect } from '@/features/shared/controls'
import { EmptyState } from '@/features/shared/data-table'
import { readableError } from '@/lib/graphql-errors'
import { PageIntro, SectionHeading } from '@/features/shared/page-intro'
import { canManageAccounts, useAdminSession } from '@/lib/auth-session'
import { formatNumber, formatStatus } from '@/lib/format'

import {
  PipelineBoard,
  RequisitionsTable,
  type ApplicationHandlers,
  type RequisitionHandlers,
} from './components'
import { ApplicationFormDrawer, RequisitionFormDrawer } from './forms'
import { useRecruitmentWorkspaceGraphql } from './hooks'
import { requisitionDone } from './presentation'
import {
  applicationFormDefaults,
  requisitionFormDefaults,
  type Department,
  type Designation,
  type JobRequisition,
  type RecruitmentApplication,
} from './types'

const REQUISITION_STATUSES = ['OPEN', 'ON_HOLD', 'FILLED', 'CLOSED']

export function RecruitmentPage() {
  const { account } = useAdminSession()
  const canManageRecruitment = canManageAccounts(account)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedRequisitionFilter, setSelectedRequisitionFilter] = useState('')
  const [showRequisitionForm, setShowRequisitionForm] = useState(false)
  const [showApplicationForm, setShowApplicationForm] = useState(false)
  const [editingRequisitionId, setEditingRequisitionId] = useState<string | null>(null)
  const [editingApplicationId, setEditingApplicationId] = useState<string | null>(null)
  const [requisitionForm, setRequisitionForm] = useState(requisitionFormDefaults)
  const [applicationForm, setApplicationForm] = useState(applicationFormDefaults)
  const [notice, setNotice] = useState<{ text: string; tone: 'success' | 'danger' } | null>(null)
  const [requisitionError, setRequisitionError] = useState<string | null>(null)
  const [applicationError, setApplicationError] = useState<string | null>(null)
  const [confirm, confirmDialog] = useConfirm()
  const pipelineRef = useRef<HTMLDivElement>(null)

  const {
    data,
    loading,
    error,
    refetch,
    createJobRequisition,
    creatingRequisition,
    updateJobRequisition,
    updatingRequisition,
    changeJobRequisitionStatus,
    changingRequisitionStatus,
    createRecruitmentApplication,
    creatingApplication,
    updateRecruitmentApplication,
    updatingApplication,
    advanceRecruitmentApplication,
    advancingApplication,
  } = useRecruitmentWorkspaceGraphql({
    applicationStatusFilter: '',
    canManageRecruitment,
    searchQuery,
    selectedRequisitionFilter,
    statusFilter,
  })

  const departments: Department[] = data?.departments ?? []
  const designations: Designation[] = data?.designations ?? []
  const requisitions: JobRequisition[] = data?.jobRequisitions ?? []
  const applications: RecruitmentApplication[] = data?.recruitmentApplications ?? []
  const summary = data?.recruitmentSummary ?? {
    openRequisitions: 0,
    activeApplications: 0,
    screeningApplications: 0,
    selectedApplications: 0,
  }
  const openRequisitions = requisitions.filter((r) => ['OPEN', 'ON_HOLD'].includes(r.status))
  const filteredDesignations = designations.filter((d) => d.departmentId === requisitionForm.departmentId)
  const currencyFor = (application: RecruitmentApplication) =>
    requisitions.find((r) => r.id === application.requisitionId)?.currencyCode ?? 'AED'

  const say = (text: string, tone: 'success' | 'danger' = 'success') => setNotice({ text, tone })

  const handleSaveRequisition = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNotice(null)
    setRequisitionError(null)
    try {
      const input = {
        jobTitle: requisitionForm.jobTitle,
        departmentId: requisitionForm.departmentId,
        designationId: requisitionForm.designationId || null,
        positionsCount: Number.parseInt(requisitionForm.positionsCount, 10),
        employmentType: requisitionForm.employmentType,
        priority: requisitionForm.priority,
        targetStartDate: requisitionForm.targetStartDate || null,
        salaryMin: parseOptionalNumber(requisitionForm.salaryMin),
        salaryMax: parseOptionalNumber(requisitionForm.salaryMax),
        currencyCode: requisitionForm.currencyCode,
        description: requisitionForm.description,
        requirements: requisitionForm.requirements || null,
      }
      if (editingRequisitionId) {
        await updateJobRequisition({ variables: { input: { id: editingRequisitionId, ...input } } })
      } else {
        await createJobRequisition({ variables: { input } })
      }
      setRequisitionForm(requisitionFormDefaults)
      setEditingRequisitionId(null)
      setShowRequisitionForm(false)
      say(editingRequisitionId ? `${input.jobTitle} updated.` : `${input.jobTitle} opened.`)
      await refetch()
    } catch (mutationError) {
      setRequisitionError(readableError(mutationError, 'The requisition could not be saved.'))
    }
  }

  const handleSaveApplication = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNotice(null)
    setApplicationError(null)
    try {
      const input = {
        firstName: applicationForm.firstName,
        lastName: applicationForm.lastName,
        email: applicationForm.email,
        phone: applicationForm.phone || null,
        source: applicationForm.source || null,
        yearsExperience: parseOptionalNumber(applicationForm.yearsExperience),
        expectedSalary: parseOptionalNumber(applicationForm.expectedSalary),
        resumeUrl: applicationForm.resumeUrl.trim() || null,
        notes: applicationForm.notes || null,
      }
      if (editingApplicationId) {
        await updateRecruitmentApplication({ variables: { input: { id: editingApplicationId, ...input } } })
      } else {
        await createRecruitmentApplication({
          variables: { input: { requisitionId: applicationForm.requisitionId, ...input } },
        })
      }
      setApplicationForm(applicationFormDefaults)
      setEditingApplicationId(null)
      setShowApplicationForm(false)
      const name = `${input.firstName} ${input.lastName}`.trim()
      say(editingApplicationId ? `${name} updated.` : `${name} added to Received.`)
      await refetch()
    } catch (mutationError) {
      setApplicationError(readableError(mutationError, 'The candidate could not be saved.'))
    }
  }

  const handleEditRequisition = (requisition: JobRequisition) => {
    setEditingRequisitionId(requisition.id)
    setRequisitionForm({
      jobTitle: requisition.jobTitle,
      departmentId: requisition.departmentId,
      designationId: requisition.designationId ?? '',
      positionsCount: String(requisition.positionsCount),
      employmentType: requisition.employmentType,
      priority: requisition.priority,
      targetStartDate: requisition.targetStartDate ?? '',
      salaryMin: requisition.salaryMin ? String(requisition.salaryMin) : '',
      salaryMax: requisition.salaryMax ? String(requisition.salaryMax) : '',
      currencyCode: requisition.currencyCode,
      description: requisition.description,
      requirements: requisition.requirements ?? '',
    })
    setNotice(null)
    setShowRequisitionForm(true)
  }

  const handleEditApplication = (application: RecruitmentApplication) => {
    setEditingApplicationId(application.id)
    setApplicationForm({
      requisitionId: application.requisitionId,
      firstName: application.firstName,
      lastName: application.lastName,
      email: application.email,
      phone: application.phone ?? '',
      source: application.source ?? '',
      yearsExperience:
        application.yearsExperience !== null && application.yearsExperience !== undefined
          ? String(application.yearsExperience)
          : '',
      expectedSalary: application.expectedSalary ? String(application.expectedSalary) : '',
      resumeUrl: application.resumeUrl ?? '',
      notes: application.notes ?? '',
    })
    setNotice(null)
    setShowApplicationForm(true)
  }

  const requisitionHandlers: RequisitionHandlers = {
    busy: changingRequisitionStatus,
    onEdit: handleEditRequisition,
    onShowCandidates: (requisition) => {
      setSelectedRequisitionFilter(requisition.id)
      pipelineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    onStatus: async (requisition, status, label) => {
      if (['FILLED', 'CLOSED'].includes(status)) {
        const ok = await confirm({
          title: `${label}: ${requisition.jobTitle}?`,
          description: 'It stops accepting new candidates. Candidates already in the pipeline stay where they are.',
          confirmLabel: label,
          tone: status === 'CLOSED' ? 'danger' : 'default',
        })
        if (!ok) return
      }
      setNotice(null)
      try {
        await changeJobRequisitionStatus({ variables: { input: { id: requisition.id, status } } })
        say(`${requisition.jobTitle} ${requisitionDone(label)}.`)
        await refetch()
      } catch (mutationError) {
        say(readableError(mutationError, 'The requisition status could not be changed.'), 'danger')
      }
    },
  }

  const applicationHandlers: ApplicationHandlers = {
    busy: advancingApplication,
    onEdit: handleEditApplication,
    onAdvance: async (application, status, done) => {
      setNotice(null)
      try {
        await advanceRecruitmentApplication({ variables: { input: { id: application.id, status, decisionNotes: null } } })
        say(`${application.candidateName} ${done}.`)
        await refetch()
      } catch (mutationError) {
        say(readableError(mutationError, 'The candidate could not be moved.'), 'danger')
      }
    },
    onClose: async (application, status) => {
      const verb = status === 'REJECTED' ? 'Reject' : 'Mark withdrawn'
      const ok = await confirm({
        title: `${verb}: ${application.candidateName}?`,
        description: 'The candidate moves to Closed. This cannot be undone.',
        confirmLabel: verb,
        tone: 'danger',
      })
      if (!ok) return
      setNotice(null)
      try {
        await advanceRecruitmentApplication({
          variables: {
            input: {
              id: application.id,
              status,
              decisionNotes: status === 'REJECTED' ? 'Rejected from the pipeline board' : 'Withdrew from the process',
            },
          },
        })
        say(`${application.candidateName} ${status === 'REJECTED' ? 'rejected' : 'marked withdrawn'}.`)
        await refetch()
      } catch (mutationError) {
        say(readableError(mutationError, 'The candidate could not be updated.'), 'danger')
      }
    },
  }

  const closeRequisitionForm = () => {
    setRequisitionError(null)
    setEditingRequisitionId(null)
    setRequisitionForm(requisitionFormDefaults)
    setShowRequisitionForm(false)
  }
  const closeApplicationForm = () => {
    setApplicationError(null)
    setEditingApplicationId(null)
    setApplicationForm(applicationFormDefaults)
    setShowApplicationForm(false)
  }

  if (!canManageRecruitment) {
    return (
      <Notice tone="warning">
        Recruitment is available to administrators and HR administrators.
      </Notice>
    )
  }

  return (
    <div className="space-y-5">
      <PageIntro
        actions={
          <>
            <Button
              onClick={() => {
                setEditingApplicationId(null)
                setApplicationForm({
                  ...applicationFormDefaults,
                  requisitionId: selectedRequisitionFilter || (openRequisitions.length === 1 ? openRequisitions[0].id : ''),
                })
                setShowApplicationForm(true)
              }}
              disabled={openRequisitions.length === 0}
              title={openRequisitions.length === 0 ? 'Open a requisition first' : undefined}
              type="button"
              variant="outline"
            >
              <UserRoundPlus className="mr-2 h-4 w-4" />
              Add candidate
            </Button>
            <Button
              onClick={() => {
                setEditingRequisitionId(null)
                setRequisitionForm(requisitionFormDefaults)
                setShowRequisitionForm(true)
              }}
              type="button"
            >
              <Plus className="mr-2 h-4 w-4" />
              New requisition
            </Button>
          </>
        }
        description="Openings and the candidates moving through each one."
        title="Recruitment"
      />

      {notice ? (
        <Notice tone={notice.tone}>
          <div className="flex items-start justify-between gap-3">
            <span>{notice.text}</span>
            <button className="shrink-0 text-xs font-semibold underline-offset-4 hover:underline" onClick={() => setNotice(null)} type="button">
              Dismiss
            </button>
          </div>
        </Notice>
      ) : null}
      {error ? <Notice tone="danger">Recruitment could not be loaded. {readableError(error, '')}</Notice> : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard detail="Open or on hold" icon={Briefcase} label="Open requisitions" value={formatNumber(summary.openRequisitions)} />
        <MetricCard detail="Still in the pipeline" icon={UserRoundPlus} label="Active candidates" value={formatNumber(summary.activeApplications)} />
        <MetricCard detail="Screening or interviews" icon={Search} label="In screening" value={formatNumber(summary.screeningApplications)} />
        <MetricCard detail="Selected, offered or hired" icon={CheckCircle2} label="Selected" value={formatNumber(summary.selectedApplications)} />
      </div>

      <div className="scroll-mt-24" ref={pipelineRef}>
        <Card>
          <CardContent className="space-y-4 p-4 sm:p-5">
            <SectionHeading description="Move each candidate one step at a time. Rejected and withdrawn candidates collect in Closed." title="Pipeline" />
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_260px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="Search roles and candidates"
                  className="h-10 pl-10"
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search candidates or roles"
                  type="search"
                  value={searchQuery}
                />
              </div>
              <FilterSelect
                allLabel="All openings"
                id="pipeline-requisition"
                label="Opening"
                onChange={setSelectedRequisitionFilter}
                options={requisitions.map((r) => ({ value: r.id, label: r.jobTitle }))}
                value={selectedRequisitionFilter}
              />
            </div>
            {loading && !data ? (
              <p className="text-sm text-muted-foreground">Loading pipeline…</p>
            ) : applications.length === 0 && !searchQuery && !selectedRequisitionFilter ? (
              <EmptyState title="No candidates yet">
                {openRequisitions.length === 0
                  ? 'Open a requisition, then add candidates to it.'
                  : 'Add a candidate to an open requisition to start the pipeline.'}
              </EmptyState>
            ) : (
              <PipelineBoard applications={applications} currencyFor={currencyFor} handlers={applicationHandlers} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <SectionHeading
            actions={
              <FilterSelect
                allLabel="Any status"
                className="w-44"
                id="requisition-status"
                label="Requisition status"
                onChange={setStatusFilter}
                options={REQUISITION_STATUSES.map((status) => ({ value: status, label: formatStatus(status) }))}
                value={statusFilter}
              />
            }
            description="Every role you are hiring for, with its candidates and target start."
            title="Requisitions"
          />
          {loading && !data ? (
            <p className="text-sm text-muted-foreground">Loading requisitions…</p>
          ) : (
            <RequisitionsTable handlers={requisitionHandlers} requisitions={requisitions} />
          )}
        </CardContent>
      </Card>

      <RequisitionFormDrawer
        closeRequisitionForm={closeRequisitionForm}
        creatingRequisition={creatingRequisition}
        departments={departments}
        editingRequisitionId={editingRequisitionId}
        error={requisitionError}
        filteredDesignations={filteredDesignations}
        handleSaveRequisition={handleSaveRequisition}
        open={showRequisitionForm}
        requisitionForm={requisitionForm}
        setRequisitionForm={setRequisitionForm}
        setShowRequisitionForm={setShowRequisitionForm}
        updatingRequisition={updatingRequisition}
      />
      <ApplicationFormDrawer
        applicationForm={applicationForm}
        closeApplicationForm={closeApplicationForm}
        creatingApplication={creatingApplication}
        editingApplicationId={editingApplicationId}
        error={applicationError}
        handleSaveApplication={handleSaveApplication}
        open={showApplicationForm}
        openRequisitions={openRequisitions}
        setApplicationForm={setApplicationForm}
        setShowApplicationForm={setShowApplicationForm}
        updatingApplication={updatingApplication}
      />
      {confirmDialog}
    </div>
  )
}

function parseOptionalNumber(value: string) {
  return value.trim() ? Number.parseFloat(value) : null
}
