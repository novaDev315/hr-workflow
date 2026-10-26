import { gql } from '@apollo/client'

export const LEAVE_PAGE_QUERY = gql`
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

// `pendingDays` is new; fall back to LEAVE_BALANCES_LEGACY_QUERY when the
// server does not know it yet.
export const LEAVE_BALANCES_QUERY = gql`
  query LeaveBalancesForReview($employeeId: ID!) {
    leaveBalances(employeeId: $employeeId) {
      leaveTypeId
      allocatedDays
      usedDays
      pendingDays
      availableDays
    }
  }
`

export const LEAVE_BALANCES_LEGACY_QUERY = gql`
  query LeaveBalancesForReviewLegacy($employeeId: ID!) {
    leaveBalances(employeeId: $employeeId) {
      leaveTypeId
      allocatedDays
      usedDays
      availableDays
    }
  }
`

export const CREATE_LEAVE_TYPE_MUTATION = gql`
  mutation CreateLeaveType($input: CreateLeaveTypeInput!) {
    createLeaveType(input: $input) {
      id
    }
  }
`

export const UPDATE_LEAVE_TYPE_MUTATION = gql`
  mutation UpdateLeaveType($input: UpdateLeaveTypeInput!) {
    updateLeaveType(input: $input) {
      id
    }
  }
`

export const DEACTIVATE_LEAVE_TYPE_MUTATION = gql`
  mutation DeactivateLeaveType($input: DeactivateLeaveTypeInput!) {
    deactivateLeaveType(input: $input) {
      id
      isActive
    }
  }
`

export const REQUEST_LEAVE_MUTATION = gql`
  mutation RequestLeave($input: RequestLeaveInput!) {
    requestLeave(input: $input) {
      id
      status
    }
  }
`

export const REVIEW_LEAVE_REQUEST_MUTATION = gql`
  mutation ReviewLeaveRequest($input: ReviewLeaveRequestInput!) {
    reviewLeaveRequest(input: $input) {
      id
      status
    }
  }
`

export type LeaveEmployee = { id: string; employeeNumber: string; fullName: string }

export type LeaveType = {
  id: string
  code: string
  name: string
  defaultDays: number
  description?: string | null
  isActive: boolean
}

export type LeaveRequest = {
  id: string
  startDate: string
  endDate: string
  totalDays: number
  status: string
  reason: string
  requestedAt?: string | null
  decidedAt?: string | null
  reviewedByName?: string | null
  decisionNotes?: string | null
  employee: LeaveEmployee
  leaveType: { id: string; code: string; name: string }
}

export type LeaveBalance = {
  leaveTypeId: string
  allocatedDays: number
  usedDays: number
  pendingDays?: number
  availableDays: number
}
