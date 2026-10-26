import { gql } from '@apollo/client'

export const DASHBOARD_QUERY = gql`
  query DashboardReports($periodMonth: String) {
    reportsDashboard(periodMonth: $periodMonth) {
      accessScopeLabel
      overview {
        activeEmployees
        pendingLeaveRequests
        processedPayrollPeriods
        publishedPolicies
        monthlyPayrollNetPay
      }
      recentHires {
        employeeNumber
        fullName
        joinDate
        departmentName
        designationTitle
      }
      pendingLeaveApprovals {
        employeeNumber
        fullName
        leaveTypeName
        startDate
        endDate
        totalDays
      }
      publishedPolicies {
        title
        category
        version
        effectiveDate
      }
    }
  }
`

export const DASHBOARD_SETUP_QUERY = gql`
  query DashboardSetup {
    companySettings {
      id
      companyName
    }
    departments {
      id
    }
    designations {
      id
    }
  }
`

export const DASHBOARD_PAYROLL_QUERY = gql`
  query DashboardPayrollPeriods {
    payrollPeriods {
      id
      periodMonth
      status
      payslipCount
    }
  }
`

export type DashboardSummary = {
  accessScopeLabel: string
  overview: {
    activeEmployees: number
    pendingLeaveRequests: number
    processedPayrollPeriods: number
    publishedPolicies: number
    monthlyPayrollNetPay: number
  }
  recentHires: Array<{
    employeeNumber: string
    fullName: string
    joinDate: string
    departmentName: string
    designationTitle: string
  }>
  pendingLeaveApprovals: Array<{
    employeeNumber: string
    fullName: string
    leaveTypeName: string
    startDate: string
    endDate: string
    totalDays: number
  }>
  publishedPolicies: Array<{
    title: string
    category: string
    version: string
    effectiveDate: string
  }>
}

export type DashboardSetup = {
  companySettings: { id: string; companyName: string } | null
  departments: Array<{ id: string }>
  designations: Array<{ id: string }>
}

export type DashboardPayrollPeriod = {
  id: string
  periodMonth: string
  status: string
  payslipCount: number
}
