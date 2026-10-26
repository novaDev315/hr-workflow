import { gql } from '@apollo/client'

export const PAYROLL_PAGE_QUERY = gql`
  query PayrollPageData {
    employees {
      id
      employeeNumber
      fullName
      isActive
    }
    employeeCompensations {
      id
      employeeId
      baseSalary
      allowanceAmount
      deductionAmount
      currencyCode
      effectiveFrom
      employee {
        id
        employeeNumber
        fullName
      }
    }
    payrollPeriods {
      id
      periodMonth
      startDate
      endDate
      status
      processedAt
      paidAt
      payslipCount
      totalNetPay
    }
  }
`

export const PAYSLIPS_QUERY = gql`
  query PayrollPayslips($filter: PayslipFilterInput) {
    payslips(filter: $filter) {
      id
      payrollPeriodId
      periodMonth
      expectedWorkdays
      attendedDays
      approvedLeaveDays
      paidDays
      unpaidDays
      grossPay
      netPay
      attendanceDeduction
      deductionAmount
      allowanceAmount
      currencyCode
      status
      employee {
        id
        employeeNumber
        fullName
      }
    }
  }
`

// New API; queried on its own so the page still works without it.
export const PAYROLL_PERIOD_PREVIEW_QUERY = gql`
  query PayrollPeriodPreview($payrollPeriodId: String!) {
    payrollPeriodPreview(payrollPeriodId: $payrollPeriodId) {
      periodMonth
      employeeCount
      missingCompensationCount
      missingCompensationNames
      estimatedGross
      estimatedNet
      currencyCode
      warnings
    }
  }
`

export const UPSERT_COMPENSATION_MUTATION = gql`
  mutation UpsertEmployeeCompensation($input: UpsertEmployeeCompensationInput!) {
    upsertEmployeeCompensation(input: $input) {
      id
    }
  }
`

export const CREATE_PAYROLL_PERIOD_MUTATION = gql`
  mutation CreatePayrollPeriod($input: CreatePayrollPeriodInput!) {
    createPayrollPeriod(input: $input) {
      id
      status
    }
  }
`

export const PROCESS_PAYROLL_PERIOD_MUTATION = gql`
  mutation ProcessPayrollPeriod($input: ProcessPayrollPeriodInput!) {
    processPayrollPeriod(input: $input) {
      id
      status
    }
  }
`

export const MARK_PAYROLL_PERIOD_PAID_MUTATION = gql`
  mutation MarkPayrollPeriodPaid($input: MarkPayrollPeriodPaidInput!) {
    markPayrollPeriodPaid(input: $input) {
      id
      status
    }
  }
`

export const DELETE_PAYROLL_PERIOD_MUTATION = gql`
  mutation DeletePayrollPeriod($input: DeletePayrollPeriodInput!) {
    deletePayrollPeriod(input: $input)
  }
`

export const EXPORT_PAYSLIP_PDF_QUERY = gql`
  query ExportPayslipPdf($payslipId: String!) {
    exportPayslipPdf(payslipId: $payslipId) {
      fileName
      mimeType
      contentBase64
    }
  }
`

export type PayrollEmployee = {
  id: string
  employeeNumber: string
  fullName: string
  isActive?: boolean
}

export type CompensationProfile = {
  id: string
  employeeId: string
  baseSalary: number
  allowanceAmount: number
  deductionAmount: number
  currencyCode: string
  effectiveFrom: string
  employee: { id: string; employeeNumber: string; fullName: string }
}

export type PayrollPeriod = {
  id: string
  periodMonth: string
  startDate: string
  endDate: string
  status: string
  processedAt?: string | null
  paidAt?: string | null
  payslipCount: number
  totalNetPay: number
}

export type Payslip = {
  id: string
  payrollPeriodId: string
  periodMonth: string
  expectedWorkdays: number
  attendedDays: number
  approvedLeaveDays: number
  paidDays: number
  unpaidDays: number
  grossPay: number
  netPay: number
  attendanceDeduction: number
  deductionAmount: number
  allowanceAmount: number
  currencyCode: string
  status: string
  employee: { id: string; employeeNumber: string; fullName: string }
}

export type PayrollPreview = {
  periodMonth: string
  employeeCount: number
  missingCompensationCount: number
  missingCompensationNames: string[]
  estimatedGross: number
  estimatedNet: number
  currencyCode: string
  warnings: string[]
}
