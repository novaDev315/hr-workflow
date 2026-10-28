import { gql } from '@apollo/client'

export const ME_QUERY = gql`
  query MobileMe {
    me {
      id
      email
      firstName
      lastName
      fullName
      isActive
      roles
      employeeId
      employeeNumber
      departmentName
      designationTitle
      employeeStatus
    }
  }
`

export const EMPLOYEE_LOCATIONS_QUERY = gql`
  query MobileEmployeeLocations($employeeId: ID!) {
    employeeLocations(employeeId: $employeeId) {
      id
      isPrimary
      location {
        id
        code
        name
        geofenceRadius
      }
    }
  }
`

export const ATTENDANCE_QUERY = gql`
  query MobileAttendance($filter: AttendanceFilterInput) {
    attendanceRecords(filter: $filter) {
      id
      attendanceDate
      clockInAt
      clockOutAt
      totalHours
      status
      location {
        id
        code
        name
      }
    }
  }
`

// Judged by the company's time zone, not the phone's clock.
export const ATTENDANCE_STATUS_QUERY = gql`
  query MobileAttendanceStatus($employeeId: ID!) {
    attendanceStatus(employeeId: $employeeId) {
      employeeId
      companyDate
      canClockIn
      canClockOut
      openRecordId
    }
  }
`

export const CLOCK_IN_MUTATION = gql`
  mutation MobileClockIn($input: ClockInInput!) {
    clockIn(input: $input) {
      id
    }
  }
`

export const CLOCK_OUT_MUTATION = gql`
  mutation MobileClockOut($input: ClockOutInput!) {
    clockOut(input: $input) {
      id
    }
  }
`

// leaveBalances takes `employeeId: ID!`; the request filter's employeeId is a String.
export const LEAVE_QUERY = gql`
  query MobileLeave($employeeId: ID!, $requestFilter: LeaveRequestFilterInput) {
    leaveTypes {
      id
      code
      name
      defaultDays
      isActive
    }
    leaveBalances(employeeId: $employeeId) {
      leaveTypeId
      allocatedDays
      usedDays
      availableDays
      leaveType {
        id
        code
        name
      }
    }
    leaveRequests(filter: $requestFilter) {
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
      leaveTypeId
      leaveType {
        id
        name
      }
    }
  }
`

/** Kept separate so a backend without `pendingDays` cannot break the leave screen. */
export const LEAVE_PENDING_QUERY = gql`
  query MobileLeavePending($employeeId: ID!) {
    leaveBalances(employeeId: $employeeId) {
      leaveTypeId
      pendingDays
    }
  }
`

/** Kept separate so a backend without `LeaveType.isPaid` cannot break the Today screen. */
export const LEAVE_PAID_QUERY = gql`
  query MobileLeavePaid($employeeId: ID!) {
    leaveBalances(employeeId: $employeeId) {
      leaveTypeId
      leaveType {
        id
        isPaid
      }
    }
  }
`

export const REQUEST_LEAVE_MUTATION = gql`
  mutation MobileRequestLeave($input: RequestLeaveInput!) {
    requestLeave(input: $input) {
      id
      status
      totalDays
    }
  }
`

export const CANCEL_LEAVE_MUTATION = gql`
  mutation MobileCancelLeave($input: CancelLeaveRequestInput!) {
    cancelLeaveRequest(input: $input) {
      id
      status
    }
  }
`

export const PAYSLIPS_QUERY = gql`
  query MobilePayslips($filter: PayslipFilterInput) {
    payslips(filter: $filter) {
      id
      periodMonth
      grossPay
      netPay
      baseSalary
      proratedBaseSalary
      allowanceAmount
      deductionAmount
      attendanceDeduction
      paidDays
      unpaidDays
      expectedWorkdays
      currencyCode
      status
    }
  }
`

export const EXPORT_PAYSLIP_QUERY = gql`
  query MobileExportPayslipPdf($payslipId: String!) {
    exportPayslipPdf(payslipId: $payslipId) {
      fileName
      mimeType
      contentBase64
    }
  }
`

export const POLICIES_QUERY = gql`
  query MobilePolicies {
    policyDocuments {
      id
      title
      category
      version
      effectiveDate
      description
      status
      documentUrl
      documentOriginalName
      content
      publishedAt
    }
  }
`

export const LOGOUT_MUTATION = gql`
  mutation MobileLogout {
    logout
  }
`

export interface AttendanceRecord {
  id: string
  attendanceDate: string
  clockInAt?: string | null
  clockOutAt?: string | null
  totalHours?: number | null
  status: string
  location?: { id: string; code: string; name: string } | null
}

export interface LocationAssignment {
  id: string
  isPrimary: boolean
  location: { id: string; code: string; name: string; geofenceRadius?: number | null }
}

export interface LeaveTypeRow {
  id: string
  code: string
  name: string
  defaultDays: number
  isActive: boolean
}

export interface LeaveBalance {
  leaveTypeId: string
  allocatedDays: number
  usedDays: number
  availableDays: number
  pendingDays?: number | null
  leaveType: { id: string; code: string; name: string }
}

export interface AttendanceStatus {
  employeeId: string
  companyDate: string
  canClockIn: boolean
  canClockOut: boolean
  openRecordId?: string | null
}

export interface LeaveRequestRow {
  id: string
  startDate: string
  endDate: string
  totalDays: number
  status: string
  reason: string
  requestedAt: string
  decidedAt?: string | null
  reviewedByName?: string | null
  decisionNotes?: string | null
  leaveTypeId: string
  leaveType: { id: string; name: string }
}

export interface Payslip {
  id: string
  periodMonth: string
  grossPay: number
  netPay: number
  baseSalary: number
  proratedBaseSalary: number
  allowanceAmount: number
  deductionAmount: number
  attendanceDeduction: number
  paidDays: number
  unpaidDays: number
  expectedWorkdays: number
  currencyCode: string
  status: string
}

export interface PolicyDocument {
  id: string
  title: string
  category: string
  version: string
  effectiveDate: string
  description: string
  status: string
  documentUrl?: string | null
  documentOriginalName?: string | null
  content?: string | null
  publishedAt?: string | null
}
