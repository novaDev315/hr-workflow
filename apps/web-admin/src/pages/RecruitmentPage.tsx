import { FormEvent, useMemo, useState } from 'react'
import { gql, useMutation, useQuery } from '@apollo/client'
import { AdminHero } from '@/components/admin/admin-hero'
import { AdminTableEmpty } from '@/components/admin/admin-table'
import { PageFeedback } from '@/components/admin/page-feedback'
import { RecordCard } from '@/components/admin/record-card'
import {
  Briefcase,
  CheckCircle2,
  Pencil,
  Plus,
  Search,
  UserRoundPlus,
  XCircle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FormDrawer } from '@/components/ui/form-drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MetricCard } from '@/components/ui/metric-card'
import { Notice } from '@/components/ui/notice'
import { StatusBadge } from '@/components/ui/status-badge'
import { canManageAccounts, readStoredAdminAccount } from '@/lib/auth-session'

const RECRUITMENT_PAGE_QUERY = gql`
  query RecruitmentPageData(
    $requisitionFilter: JobRequisitionFilterInput
    $applicationFilter: RecruitmentApplicationFilterInput
  ) {
    departments(includeInactive: false) {
      id
      name
      code
    }
    designations(includeInactive: false) {
      id
      title
      departmentId
    }
    recruitmentSummary {
      openRequisitions
      activeApplications
      screeningApplications
      selectedApplications
    }
    jobRequisitions(filter: $requisitionFilter) {
      id
      requisitionNumber
      jobTitle
      departmentId
      departmentName
      designationId
      designationTitle
      positionsCount
      employmentType
      priority
      status
      targetStartDate
      salaryMin
      salaryMax
      currencyCode
      description
      requirements
      applicationCount
      openedAt
      closedAt
    }
    recruitmentApplications(filter: $applicationFilter) {
      id
      applicationNumber
      requisitionId
      requisitionNumber
      jobTitle
      candidateName
      firstName
      lastName
      email
      phone
      source
      yearsExperience
      expectedSalary
      resumeUrl
      status
      notes
      decisionNotes
      appliedAt
      lastActionAt
      lastActionByName
    }
  }
`

const CREATE_JOB_REQUISITION_MUTATION = gql`
  mutation CreateJobRequisition($input: CreateJobRequisitionInput!) {
    createJobRequisition(input: $input) {
      id
    }
  }
`

const UPDATE_JOB_REQUISITION_MUTATION = gql`
  mutation UpdateJobRequisition($input: UpdateJobRequisitionInput!) {
    updateJobRequisition(input: $input) {
      id
    }
  }
`

const CHANGE_JOB_REQUISITION_STATUS_MUTATION = gql`
  mutation ChangeJobRequisitionStatus(
    $input: ChangeJobRequisitionStatusInput!
  ) {
    changeJobRequisitionStatus(input: $input) {
      id
      status
    }
  }
`

const CREATE_RECRUITMENT_APPLICATION_MUTATION = gql`
  mutation CreateRecruitmentApplication(
    $input: CreateRecruitmentApplicationInput!
  ) {
    createRecruitmentApplication(input: $input) {
      id
    }
  }
`

const UPDATE_RECRUITMENT_APPLICATION_MUTATION = gql`
  mutation UpdateRecruitmentApplication(
    $input: UpdateRecruitmentApplicationInput!
  ) {
    updateRecruitmentApplication(input: $input) {
      id
    }
  }
`

const ADVANCE_RECRUITMENT_APPLICATION_MUTATION = gql`
  mutation AdvanceRecruitmentApplication(
    $input: AdvanceRecruitmentApplicationInput!
  ) {
    advanceRecruitmentApplication(input: $input) {
      id
      status
    }
  }
`

type Department = {
  id: string
  name: string
  code: string
}

type Designation = {
  id: string
  title: string
  departmentId: string
}

type JobRequisition = {
  id: string
  requisitionNumber: string
  jobTitle: string
  departmentId: string
  departmentName: string
  designationId?: string | null
  designationTitle?: string | null
  positionsCount: number
  employmentType: string
  priority: string
  status: string
  targetStartDate?: string | null
  salaryMin?: number | null
  salaryMax?: number | null
  currencyCode: string
  description: string
  requirements?: string | null
  applicationCount: number
  openedAt: string
  closedAt?: string | null
}

type RecruitmentApplication = {
  id: string
  applicationNumber: string
  requisitionId: string
  requisitionNumber: string
  jobTitle: string
  candidateName: string
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  source?: string | null
  yearsExperience?: number | null
  expectedSalary?: number | null
  resumeUrl?: string | null
  status: string
  notes?: string | null
  decisionNotes?: string | null
  appliedAt: string
  lastActionAt?: string | null
  lastActionByName?: string | null
}

type RequisitionFormState = {
  jobTitle: string
  departmentId: string
  designationId: string
  positionsCount: string
  employmentType: string
  priority: string
  targetStartDate: string
  salaryMin: string
  salaryMax: string
  currencyCode: string
  description: string
  requirements: string
}

type ApplicationFormState = {
  requisitionId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  source: string
  yearsExperience: string
  expectedSalary: string
  resumeUrl: string
  notes: string
}

const requisitionFormDefaults: RequisitionFormState = {
  jobTitle: '',
  departmentId: '',
  designationId: '',
  positionsCount: '1',
  employmentType: 'FULL_TIME',
  priority: 'MEDIUM',
  targetStartDate: '',
  salaryMin: '',
  salaryMax: '',
  currencyCode: 'AED',
  description: '',
  requirements: '',
}

const applicationFormDefaults: ApplicationFormState = {
  requisitionId: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  source: '',
  yearsExperience: '',
  expectedSalary: '',
  resumeUrl: '',
  notes: '',
}

const selectClassName =
  'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20'

export function RecruitmentPage() {
  const currentAdminAccount = readStoredAdminAccount()
  const canManageRecruitment = canManageAccounts(
    currentAdminAccount?.roles ?? [],
  )
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

  const queryVariables = useMemo(
    () => ({
      requisitionFilter: {
        ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      applicationFilter: {
        ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
        ...(applicationStatusFilter ? { status: applicationStatusFilter } : {}),
        ...(selectedRequisitionFilter
          ? { requisitionId: selectedRequisitionFilter }
          : {}),
      },
    }),
    [
      applicationStatusFilter,
      searchQuery,
      selectedRequisitionFilter,
      statusFilter,
    ],
  )

  const { data, loading, error, refetch } = useQuery(RECRUITMENT_PAGE_QUERY, {
    skip: !canManageRecruitment,
    variables: queryVariables,
  })
  const [createJobRequisition, { loading: creatingRequisition }] = useMutation(
    CREATE_JOB_REQUISITION_MUTATION,
  )
  const [updateJobRequisition, { loading: updatingRequisition }] = useMutation(
    UPDATE_JOB_REQUISITION_MUTATION,
  )
  const [changeJobRequisitionStatus, { loading: changingRequisitionStatus }] =
    useMutation(CHANGE_JOB_REQUISITION_STATUS_MUTATION)
  const [createRecruitmentApplication, { loading: creatingApplication }] =
    useMutation(CREATE_RECRUITMENT_APPLICATION_MUTATION)
  const [updateRecruitmentApplication, { loading: updatingApplication }] =
    useMutation(UPDATE_RECRUITMENT_APPLICATION_MUTATION)
  const [advanceRecruitmentApplication, { loading: advancingApplication }] =
    useMutation(ADVANCE_RECRUITMENT_APPLICATION_MUTATION)

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
              <select
                id="requisition-status-filter"
                className={selectClassName}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">All requisitions</option>
                <option value="OPEN">Open</option>
                <option value="ON_HOLD">On hold</option>
                <option value="FILLED">Filled</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
            <div>
              <Label htmlFor="application-status-filter">
                Application status
              </Label>
              <select
                id="application-status-filter"
                className={selectClassName}
                value={applicationStatusFilter}
                onChange={(event) =>
                  setApplicationStatusFilter(event.target.value)
                }
              >
                <option value="">All applications</option>
                {applicationStatuses.map((status) => (
                  <option key={status} value={status}>
                    {formatStatus(status)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="application-requisition-filter">
                Requisition
              </Label>
              <select
                id="application-requisition-filter"
                className={selectClassName}
                value={selectedRequisitionFilter}
                onChange={(event) =>
                  setSelectedRequisitionFilter(event.target.value)
                }
              >
                <option value="">All roles</option>
                {requisitions.map((requisition) => (
                  <option key={requisition.id} value={requisition.id}>
                    {requisition.jobTitle}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <FormDrawer
        open={showRequisitionForm}
        onOpenChange={(open) => {
          if (open) {
            setShowRequisitionForm(true)
          } else {
            closeRequisitionForm()
          }
        }}
        kicker="Opening"
        title={editingRequisitionId ? 'Edit requisition' : 'Create requisition'}
        description="Keep the hiring list in view while you add or update the role details."
      >
        <form className="space-y-4" onSubmit={handleSaveRequisition}>
          <div className="grid gap-3 lg:grid-cols-3">
            <div>
              <Label htmlFor="requisition-title">Job title</Label>
              <Input
                id="requisition-title"
                required
                value={requisitionForm.jobTitle}
                onChange={(event) =>
                  setRequisitionForm((current) => ({
                    ...current,
                    jobTitle: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="requisition-department">Department</Label>
              <select
                id="requisition-department"
                required
                className={selectClassName}
                value={requisitionForm.departmentId}
                onChange={(event) =>
                  setRequisitionForm((current) => ({
                    ...current,
                    departmentId: event.target.value,
                    designationId: '',
                  }))
                }
              >
                <option value="">Select department</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="requisition-designation">Designation</Label>
              <select
                id="requisition-designation"
                className={selectClassName}
                value={requisitionForm.designationId}
                onChange={(event) =>
                  setRequisitionForm((current) => ({
                    ...current,
                    designationId: event.target.value,
                  }))
                }
              >
                <option value="">Any designation</option>
                {filteredDesignations.map((designation) => (
                  <option key={designation.id} value={designation.id}>
                    {designation.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="requisition-positions">Positions</Label>
              <Input
                id="requisition-positions"
                min="1"
                required
                type="number"
                value={requisitionForm.positionsCount}
                onChange={(event) =>
                  setRequisitionForm((current) => ({
                    ...current,
                    positionsCount: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="requisition-employment-type">
                Employment type
              </Label>
              <select
                id="requisition-employment-type"
                className={selectClassName}
                value={requisitionForm.employmentType}
                onChange={(event) =>
                  setRequisitionForm((current) => ({
                    ...current,
                    employmentType: event.target.value,
                  }))
                }
              >
                <option value="FULL_TIME">Full time</option>
                <option value="PART_TIME">Part time</option>
                <option value="CONTRACT">Contract</option>
                <option value="INTERNSHIP">Internship</option>
              </select>
            </div>
            <div>
              <Label htmlFor="requisition-priority">Priority</Label>
              <select
                id="requisition-priority"
                className={selectClassName}
                value={requisitionForm.priority}
                onChange={(event) =>
                  setRequisitionForm((current) => ({
                    ...current,
                    priority: event.target.value,
                  }))
                }
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div>
              <Label htmlFor="requisition-target-start">Target start</Label>
              <Input
                id="requisition-target-start"
                type="date"
                value={requisitionForm.targetStartDate}
                onChange={(event) =>
                  setRequisitionForm((current) => ({
                    ...current,
                    targetStartDate: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="requisition-salary-min">Salary min</Label>
              <Input
                id="requisition-salary-min"
                min="0"
                type="number"
                value={requisitionForm.salaryMin}
                onChange={(event) =>
                  setRequisitionForm((current) => ({
                    ...current,
                    salaryMin: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="requisition-salary-max">Salary max</Label>
              <Input
                id="requisition-salary-max"
                min="0"
                type="number"
                value={requisitionForm.salaryMax}
                onChange={(event) =>
                  setRequisitionForm((current) => ({
                    ...current,
                    salaryMax: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div>
              <Label htmlFor="requisition-description">Description</Label>
              <textarea
                id="requisition-description"
                required
                className={`${selectClassName} min-h-[110px] py-2`}
                value={requisitionForm.description}
                onChange={(event) =>
                  setRequisitionForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="requisition-requirements">Requirements</Label>
              <textarea
                id="requisition-requirements"
                className={`${selectClassName} min-h-[110px] py-2`}
                value={requisitionForm.requirements}
                onChange={(event) =>
                  setRequisitionForm((current) => ({
                    ...current,
                    requirements: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={creatingRequisition || updatingRequisition}
            >
              {editingRequisitionId
                ? 'Update Requisition'
                : 'Create Requisition'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={closeRequisitionForm}
            >
              Cancel
            </Button>
          </div>
        </form>
      </FormDrawer>

      <FormDrawer
        open={showApplicationForm}
        onOpenChange={(open) => {
          if (open) {
            setShowApplicationForm(true)
          } else {
            closeApplicationForm()
          }
        }}
        kicker="Candidate"
        title={editingApplicationId ? 'Edit application' : 'Add candidate'}
        description="Capture the candidate without leaving the recruitment workflow."
      >
        <form className="space-y-4" onSubmit={handleSaveApplication}>
          <div className="grid gap-3 lg:grid-cols-3">
            <div>
              <Label htmlFor="application-requisition">Requisition</Label>
              <select
                id="application-requisition"
                required
                className={selectClassName}
                value={applicationForm.requisitionId}
                onChange={(event) =>
                  setApplicationForm((current) => ({
                    ...current,
                    requisitionId: event.target.value,
                  }))
                }
              >
                <option value="">Select requisition</option>
                {openRequisitions.map((requisition) => (
                  <option key={requisition.id} value={requisition.id}>
                    {requisition.jobTitle}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="candidate-first-name">First name</Label>
              <Input
                id="candidate-first-name"
                required
                value={applicationForm.firstName}
                onChange={(event) =>
                  setApplicationForm((current) => ({
                    ...current,
                    firstName: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="candidate-last-name">Last name</Label>
              <Input
                id="candidate-last-name"
                required
                value={applicationForm.lastName}
                onChange={(event) =>
                  setApplicationForm((current) => ({
                    ...current,
                    lastName: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="candidate-email">Email</Label>
              <Input
                id="candidate-email"
                required
                type="email"
                value={applicationForm.email}
                onChange={(event) =>
                  setApplicationForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="candidate-phone">Phone</Label>
              <Input
                id="candidate-phone"
                value={applicationForm.phone}
                onChange={(event) =>
                  setApplicationForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="candidate-source">Source</Label>
              <Input
                id="candidate-source"
                value={applicationForm.source}
                onChange={(event) =>
                  setApplicationForm((current) => ({
                    ...current,
                    source: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="candidate-experience">Years experience</Label>
              <Input
                id="candidate-experience"
                min="0"
                step="0.5"
                type="number"
                value={applicationForm.yearsExperience}
                onChange={(event) =>
                  setApplicationForm((current) => ({
                    ...current,
                    yearsExperience: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="candidate-expected-salary">Expected salary</Label>
              <Input
                id="candidate-expected-salary"
                min="0"
                type="number"
                value={applicationForm.expectedSalary}
                onChange={(event) =>
                  setApplicationForm((current) => ({
                    ...current,
                    expectedSalary: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="candidate-resume-url">Resume URL</Label>
              <Input
                id="candidate-resume-url"
                value={applicationForm.resumeUrl}
                onChange={(event) =>
                  setApplicationForm((current) => ({
                    ...current,
                    resumeUrl: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <div>
            <Label htmlFor="candidate-notes">Notes</Label>
            <textarea
              id="candidate-notes"
              className={`${selectClassName} min-h-[100px] py-2`}
              value={applicationForm.notes}
              onChange={(event) =>
                setApplicationForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={creatingApplication || updatingApplication}
            >
              {editingApplicationId ? 'Update Candidate' : 'Add Candidate'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={closeApplicationForm}
            >
              Cancel
            </Button>
          </div>
        </form>
      </FormDrawer>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card>
          <CardHeader>
            <p className="app-kicker">Openings</p>
            <CardTitle>Job requisitions</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">
                Loading requisitions...
              </p>
            ) : requisitions.length === 0 ? (
              <AdminTableEmpty>
                No requisitions match the current filters.
              </AdminTableEmpty>
            ) : (
              <div className="space-y-3">
                {requisitions.map((requisition) => (
                  <RecordCard key={requisition.id}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-foreground">
                            {requisition.jobTitle}
                          </p>
                          <StatusBadge tone={statusTone(requisition.status)}>
                            {formatStatus(requisition.status)}
                          </StatusBadge>
                          <StatusBadge
                            tone={priorityTone(requisition.priority)}
                          >
                            {formatStatus(requisition.priority)}
                          </StatusBadge>
                        </div>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          {requisition.requisitionNumber} ·{' '}
                          {requisition.departmentName}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {requisition.description}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {requisition.positionsCount} position
                          {requisition.positionsCount === 1 ? '' : 's'} ·{' '}
                          {formatStatus(requisition.employmentType)} ·{' '}
                          {requisition.applicationCount} candidate
                          {requisition.applicationCount === 1 ? '' : 's'}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() => handleEditRequisition(requisition)}
                        >
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          Edit
                        </Button>
                        {requisition.status === 'ON_HOLD' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            disabled={changingRequisitionStatus}
                            onClick={() =>
                              handleRequisitionStatus(
                                requisition.id,
                                'OPEN',
                                'Reopen',
                              )
                            }
                          >
                            Reopen
                          </Button>
                        ) : requisition.status === 'OPEN' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            disabled={changingRequisitionStatus}
                            onClick={() =>
                              handleRequisitionStatus(
                                requisition.id,
                                'ON_HOLD',
                                'Hold',
                              )
                            }
                          >
                            Hold
                          </Button>
                        ) : null}
                        {['OPEN', 'ON_HOLD'].includes(requisition.status) ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              type="button"
                              disabled={changingRequisitionStatus}
                              onClick={() =>
                                handleRequisitionStatus(
                                  requisition.id,
                                  'FILLED',
                                  'Mark filled',
                                )
                              }
                            >
                              Mark Filled
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              type="button"
                              disabled={changingRequisitionStatus}
                              onClick={() =>
                                handleRequisitionStatus(
                                  requisition.id,
                                  'CLOSED',
                                  'Close',
                                )
                              }
                            >
                              Close
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </RecordCard>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="app-kicker">Candidates</p>
            <CardTitle>Application workflow</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">
                Loading applications...
              </p>
            ) : applications.length === 0 ? (
              <AdminTableEmpty>
                No applications match the current filters.
              </AdminTableEmpty>
            ) : (
              <div className="space-y-3">
                {applications.map((application) => {
                  const nextAction = nextApplicationAction(application.status)
                  return (
                    <RecordCard key={application.id}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-foreground">
                              {application.candidateName}
                            </p>
                            <StatusBadge tone={statusTone(application.status)}>
                              {formatStatus(application.status)}
                            </StatusBadge>
                          </div>
                          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            {application.applicationNumber} ·{' '}
                            {application.jobTitle}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {application.email}
                            {application.phone ? ` · ${application.phone}` : ''}
                            {application.source
                              ? ` · ${application.source}`
                              : ''}
                          </p>
                          {application.notes ? (
                            <p className="mt-2 text-sm text-muted-foreground">
                              {application.notes}
                            </p>
                          ) : null}
                          {application.decisionNotes ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Decision: {application.decisionNotes}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            onClick={() => handleEditApplication(application)}
                          >
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            Edit
                          </Button>
                          {nextAction ? (
                            <Button
                              size="sm"
                              type="button"
                              disabled={advancingApplication}
                              onClick={() =>
                                handleApplicationStatus(
                                  application.id,
                                  nextAction.status,
                                  nextAction.label,
                                )
                              }
                            >
                              {nextAction.label}
                            </Button>
                          ) : null}
                          {!isTerminalApplication(application.status) ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                type="button"
                                disabled={advancingApplication}
                                onClick={() =>
                                  handleApplicationStatus(
                                    application.id,
                                    'REJECTED',
                                    'Reject',
                                  )
                                }
                              >
                                <XCircle className="mr-2 h-3.5 w-3.5" />
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                type="button"
                                disabled={advancingApplication}
                                onClick={() =>
                                  handleApplicationStatus(
                                    application.id,
                                    'WITHDRAWN',
                                    'Withdraw',
                                  )
                                }
                              >
                                Withdraw
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </RecordCard>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
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

function formatStatus(status: string) {
  return status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ')
}

function statusTone(status: string) {
  if (['OPEN', 'HIRED', 'SELECTED', 'OFFER_EXTENDED'].includes(status)) {
    return 'success'
  }
  if (
    ['SCREENING', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED'].includes(
      status,
    )
  ) {
    return 'info'
  }
  if (['ON_HOLD', 'RECEIVED'].includes(status)) {
    return 'warning'
  }
  if (['REJECTED', 'WITHDRAWN', 'CLOSED'].includes(status)) {
    return 'danger'
  }
  return 'neutral'
}

function priorityTone(priority: string) {
  if (['HIGH', 'URGENT'].includes(priority)) return 'danger'
  if (priority === 'MEDIUM') return 'warning'
  return 'neutral'
}

function nextApplicationAction(status: string) {
  const actions: Record<string, { status: string; label: string }> = {
    RECEIVED: { status: 'SCREENING', label: 'Start Screening' },
    SCREENING: { status: 'SHORTLISTED', label: 'Shortlist' },
    SHORTLISTED: { status: 'INTERVIEW_SCHEDULED', label: 'Schedule Interview' },
    INTERVIEW_SCHEDULED: { status: 'INTERVIEWED', label: 'Mark Interviewed' },
    INTERVIEWED: { status: 'SELECTED', label: 'Select' },
    SELECTED: { status: 'OFFER_EXTENDED', label: 'Extend Offer' },
    OFFER_EXTENDED: { status: 'HIRED', label: 'Mark Hired' },
  }

  return actions[status] ?? null
}

function isTerminalApplication(status: string) {
  return ['HIRED', 'REJECTED', 'WITHDRAWN'].includes(status)
}

function actionPastTense(label: string) {
  const labels: Record<string, string> = {
    Close: 'closed',
    Hold: 'held',
    Reopen: 'reopened',
    'Mark filled': 'marked filled',
    Reject: 'rejected',
    Withdraw: 'withdrawn',
  }

  return labels[label] ?? label.toLowerCase()
}
