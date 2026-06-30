export type Department = {
  id: string
  name: string
  code: string
}

export type Designation = {
  id: string
  title: string
  departmentId: string
}

export type JobRequisition = {
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

export type RecruitmentApplication = {
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

export type RequisitionFormState = {
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

export type ApplicationFormState = {
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

export const requisitionFormDefaults: RequisitionFormState = {
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

export const applicationFormDefaults: ApplicationFormState = {
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
