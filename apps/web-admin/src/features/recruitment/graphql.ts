import { gql } from '@apollo/client'

export const RECRUITMENT_PAGE_QUERY = gql`
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

export const CREATE_JOB_REQUISITION_MUTATION = gql`
  mutation CreateJobRequisition($input: CreateJobRequisitionInput!) {
    createJobRequisition(input: $input) {
      id
    }
  }
`

export const UPDATE_JOB_REQUISITION_MUTATION = gql`
  mutation UpdateJobRequisition($input: UpdateJobRequisitionInput!) {
    updateJobRequisition(input: $input) {
      id
    }
  }
`

export const CHANGE_JOB_REQUISITION_STATUS_MUTATION = gql`
  mutation ChangeJobRequisitionStatus(
    $input: ChangeJobRequisitionStatusInput!
  ) {
    changeJobRequisitionStatus(input: $input) {
      id
      status
    }
  }
`

export const CREATE_RECRUITMENT_APPLICATION_MUTATION = gql`
  mutation CreateRecruitmentApplication(
    $input: CreateRecruitmentApplicationInput!
  ) {
    createRecruitmentApplication(input: $input) {
      id
    }
  }
`

export const UPDATE_RECRUITMENT_APPLICATION_MUTATION = gql`
  mutation UpdateRecruitmentApplication(
    $input: UpdateRecruitmentApplicationInput!
  ) {
    updateRecruitmentApplication(input: $input) {
      id
    }
  }
`

export const ADVANCE_RECRUITMENT_APPLICATION_MUTATION = gql`
  mutation AdvanceRecruitmentApplication(
    $input: AdvanceRecruitmentApplicationInput!
  ) {
    advanceRecruitmentApplication(input: $input) {
      id
      status
    }
  }
`
