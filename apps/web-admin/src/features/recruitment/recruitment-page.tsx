import { FormEvent, useState } from 'react'
import { AdminHero } from '@/components/admin/admin-hero'
import { PageFeedback } from '@/components/admin/page-feedback'
import {
  Briefcase,
  CheckCircle2,
  Plus,
  Search,
  UserRoundPlus,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MetricCard } from '@/components/ui/metric-card'
import { Notice } from '@/components/ui/notice'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { canManageAccounts, readStoredAdminAccount } from '@/lib/auth-session'
import {
  JobRequisitionListCard,
  RecruitmentApplicationListCard,
} from './components'
import { ApplicationFormDrawer, RequisitionFormDrawer } from './forms'
import { useRecruitmentWorkspaceGraphql } from './hooks'
import { actionPastTense, formatStatus } from './presentation'
import {
  applicationFormDefaults,
  requisitionFormDefaults,
  type Department,
  type Designation,
  type JobRequisition,
  type RecruitmentApplication,
} from './types'

const ALL_REQUISITION_STATUSES_VALUE = 'ALL_REQUISITION_STATUSES'
const ALL_APPLICATION_STATUSES_VALUE = 'ALL_APPLICATION_STATUSES'
const ALL_REQUISITIONS_VALUE = 'ALL_REQUISITIONS'

export function RecruitmentPage() {
  const currentAdminAccount = readStoredAdminAccount()
  const canManageRecruitment = canManageAccounts(currentAdminAccount)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [applicationStatusFilter, setApplicationStatusFilter] = useState('')
  const [selectedRequisitionFilter, setSelectedRequisitionFilter] = useState('')
  const [showRequisitionForm, setShowRequisitionForm] = useState(false)
  const [showApplicationForm, setShowApplicationForm] = useState(false)
  const [editingRequisitionId, setEditingRequisitionId] = useState<
    string | null
  >(null)
  const [editingApplicationId, setEditingApplicationId] = useState<
    string | null
  >(null)
  const [requisitionForm, setRequisitionForm] = useState(
    requisitionFormDefaults,
  )
  const [applicationForm, setApplicationForm] = useState(
    applicationFormDefaults,
  )
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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
    applicationStatusFilter,
    canManageRecruitment,
    searchQuery,
    selectedRequisitionFilter,
    statusFilter,
  })

  const departments: Department[] = data?.departments ?? []
  const designations: Designation[] = data?.designations ?? []
  const requisitions: JobRequisition[] = data?.jobRequisitions ?? []
  const applications: RecruitmentApplication[] =
    data?.recruitmentApplications ?? []
  const summary = data?.recruitmentSummary ?? {
    openRequisitions: 0,
    activeApplications: 0,
    screeningApplications: 0,
    selectedApplications: 0,
  }
  const openRequisitions = requisitions.filter((requisition) =>
    ['OPEN', 'ON_HOLD'].includes(requisition.status),
  )
  const filteredDesignations = designations.filter(
    (designation) => designation.departmentId === requisitionForm.departmentId,
  )

  const handleSaveRequisition = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setStatusMessage(null)

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
        await updateJobRequisition({
          variables: {
            input: {
              id: editingRequisitionId,
              ...input,
            },
          },
        })
      } else {
        await createJobRequisition({
          variables: {
            input,
          },
        })
      }

      setRequisitionForm(requisitionFormDefaults)
      setEditingRequisitionId(null)
      setShowRequisitionForm(false)
      setStatusMessage(
        editingRequisitionId
          ? 'Job requisition updated.'
          : 'Job requisition created.',
      )
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        toErrorMessage(mutationError, 'Unable to save requisition.'),
      )
    }
  }

  const handleSaveApplication = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      const input = {
        firstName: applicationForm.firstName,
        lastName: applicationForm.lastName,
        email: applicationForm.email,
        phone: applicationForm.phone || null,
        source: applicationForm.source || null,
        yearsExperience: parseOptionalNumber(applicationForm.yearsExperience),
        expectedSalary: parseOptionalNumber(applicationForm.expectedSalary),
        resumeUrl: applicationForm.resumeUrl || null,
        notes: applicationForm.notes || null,
      }

      if (editingApplicationId) {
        await updateRecruitmentApplication({
          variables: {
            input: {
              id: editingApplicationId,
              ...input,
            },
          },
        })
      } else {
        await createRecruitmentApplication({
          variables: {
            input: {
              requisitionId: applicationForm.requisitionId,
              ...input,
            },
          },
        })
      }

      setApplicationForm(applicationFormDefaults)
      setEditingApplicationId(null)
      setShowApplicationForm(false)
      setStatusMessage(
        editingApplicationId
          ? 'Recruitment application updated.'
          : 'Recruitment application created.',
      )
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        toErrorMessage(mutationError, 'Unable to save application.'),
      )
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
    setErrorMessage(null)
    setStatusMessage(null)
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
      yearsExperience: application.yearsExperience
        ? String(application.yearsExperience)
        : '',
      expectedSalary: application.expectedSalary
        ? String(application.expectedSalary)
        : '',
      resumeUrl: application.resumeUrl ?? '',
      notes: application.notes ?? '',
    })
    setErrorMessage(null)
    setStatusMessage(null)
    setShowApplicationForm(true)
  }

  const handleRequisitionStatus = async (
    requisitionId: string,
    status: string,
    label: string,
  ) => {
    if (
      ['FILLED', 'CLOSED'].includes(status) &&
      !window.confirm(`${label} this requisition?`)
    ) {
      return
    }

    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await changeJobRequisitionStatus({
        variables: {
          input: {
            id: requisitionId,
            status,
          },
        },
      })
      setStatusMessage(`Job requisition ${actionPastTense(label)}.`)
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        toErrorMessage(mutationError, 'Unable to update requisition status.'),
      )
    }
  }

  const handleApplicationStatus = async (
    applicationId: string,
    status: string,
    label: string,
  ) => {
    const terminal = ['REJECTED', 'WITHDRAWN'].includes(status)
    if (terminal && !window.confirm(`${label} this application?`)) {
      return
    }

    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await advanceRecruitmentApplication({
        variables: {
          input: {
            id: applicationId,
            status,
            decisionNotes: terminal
              ? `${label} from recruitment workspace`
              : null,
          },
        },
      })
      setStatusMessage(
        terminal
          ? `Recruitment application ${actionPastTense(label)}.`
          : 'Recruitment application advanced.',
      )
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        toErrorMessage(mutationError, 'Unable to update application status.'),
      )
    }
  }

  const closeRequisitionForm = () => {
    setEditingRequisitionId(null)
    setRequisitionForm(requisitionFormDefaults)
    setShowRequisitionForm(false)
  }

  const closeApplicationForm = () => {
    setEditingApplicationId(null)
    setApplicationForm(applicationFormDefaults)
    setShowApplicationForm(false)
  }

  const openRequisitionForm = () => {
    setEditingRequisitionId(null)
    setRequisitionForm(requisitionFormDefaults)
    setShowRequisitionForm(true)
  }

  const openApplicationForm = () => {
    setEditingApplicationId(null)
    setApplicationForm(applicationFormDefaults)
    setShowApplicationForm(true)
  }

  if (!canManageRecruitment) {
    return (
      <Notice tone="warning">
        Recruitment records are restricted to administrator and HR administrator
        accounts.
      </Notice>
    )
  }

  return (
    <div className="space-y-4">
      <AdminHero
        kicker="Recruitment"
        title="Manage openings and candidate movement."
        description="Track live requisitions, add candidates, and move applications through a controlled hiring path."
        actions={
          <>
            <Button type="button" onClick={openRequisitionForm}>
              <Plus className="mr-2 h-4 w-4" />
              New requisition
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={openApplicationForm}
            >
              <UserRoundPlus className="mr-2 h-4 w-4" />
              Add candidate
            </Button>
          </>
        }
      />

      <PageFeedback
        errorMessage={errorMessage}
        statusMessage={statusMessage}
        loadError={error}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Open requisitions"
          value={String(summary.openRequisitions)}
          detail="Open or on hold"
          icon={Briefcase}
        />
        <MetricCard
          label="Active candidates"
          value={String(summary.activeApplications)}
          detail="Still in workflow"
          icon={UserRoundPlus}
        />
        <MetricCard
          label="Screening"
          value={String(summary.screeningApplications)}
          detail="Screening or interviews"
          icon={Search}
        />
        <MetricCard
          label="Selected"
          value={String(summary.selectedApplications)}
          detail="Selected, offered, hired"
          icon={CheckCircle2}
        />
      </div>

      <Card>
        <CardHeader>
          <p className="app-kicker">Filters</p>
          <CardTitle>Find hiring work</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
            <div>
              <Label htmlFor="recruitment-search">Search</Label>
              <Input
                id="recruitment-search"
                placeholder="Search roles, candidates, emails"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="requisition-status-filter">
                Requisition status
              </Label>
              <Select
                name="requisition-status-filter"
                value={statusFilter || ALL_REQUISITION_STATUSES_VALUE}
                onValueChange={(status) =>
                  setStatusFilter(
                    status === ALL_REQUISITION_STATUSES_VALUE ? '' : status
                  )
                }
              >
                <SelectTrigger id="requisition-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_REQUISITION_STATUSES_VALUE}>
                    All requisitions
                  </SelectItem>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="ON_HOLD">On hold</SelectItem>
                  <SelectItem value="FILLED">Filled</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="application-status-filter">
                Application status
              </Label>
              <Select
                name="application-status-filter"
                value={applicationStatusFilter || ALL_APPLICATION_STATUSES_VALUE}
                onValueChange={(status) =>
                  setApplicationStatusFilter(
                    status === ALL_APPLICATION_STATUSES_VALUE ? '' : status
                  )
                }
              >
                <SelectTrigger id="application-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_APPLICATION_STATUSES_VALUE}>
                    All applications
                  </SelectItem>
                  {applicationStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {formatStatus(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="application-requisition-filter">
                Requisition
              </Label>
              <Select
                name="application-requisition-filter"
                value={selectedRequisitionFilter || ALL_REQUISITIONS_VALUE}
                onValueChange={(requisitionId) =>
                  setSelectedRequisitionFilter(
                    requisitionId === ALL_REQUISITIONS_VALUE ? '' : requisitionId
                  )
                }
              >
                <SelectTrigger id="application-requisition-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_REQUISITIONS_VALUE}>All roles</SelectItem>
                  {requisitions.map((requisition) => (
                    <SelectItem key={requisition.id} value={requisition.id}>
                      {requisition.jobTitle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <RequisitionFormDrawer
        closeRequisitionForm={closeRequisitionForm}
        creatingRequisition={creatingRequisition}
        departments={departments}
        editingRequisitionId={editingRequisitionId}
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
        handleSaveApplication={handleSaveApplication}
        open={showApplicationForm}
        openRequisitions={openRequisitions}
        setApplicationForm={setApplicationForm}
        setShowApplicationForm={setShowApplicationForm}
        updatingApplication={updatingApplication}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <JobRequisitionListCard
          changingRequisitionStatus={changingRequisitionStatus}
          handleEditRequisition={handleEditRequisition}
          handleRequisitionStatus={handleRequisitionStatus}
          loading={loading}
          requisitions={requisitions}
        />

        <RecruitmentApplicationListCard
          advancingApplication={advancingApplication}
          applications={applications}
          handleApplicationStatus={handleApplicationStatus}
          handleEditApplication={handleEditApplication}
          loading={loading}
        />
      </div>
    </div>
  )
}

const applicationStatuses = [
  'RECEIVED',
  'SCREENING',
  'SHORTLISTED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEWED',
  'SELECTED',
  'OFFER_EXTENDED',
  'HIRED',
  'REJECTED',
  'WITHDRAWN',
]

function parseOptionalNumber(value: string) {
  return value.trim() ? Number.parseFloat(value) : null
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}
