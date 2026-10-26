import { formatNumber, plural } from '@/lib/format'

import type { CompensationProfile, PayrollEmployee, PayrollPeriod, PayrollPreview } from './graphql'

export function periodTone(status: string) {
  if (status === 'PAID') return 'success' as const
  if (status === 'PROCESSED') return 'info' as const
  return 'warning' as const
}

export function periodStatusLabel(status: string) {
  if (status === 'OPEN') return 'Not processed'
  if (status === 'PROCESSED') return 'Awaiting payment'
  if (status === 'PAID') return 'Paid'
  return status
}

export function sortPeriodsNewestFirst(periods: PayrollPeriod[]) {
  return [...periods].sort((a, b) => b.periodMonth.localeCompare(a.periodMonth))
}

// "22 of 22 days", "20.5 of 22 days"
export function formatPaidDays(paidDays: number, expectedWorkdays: number) {
  const paid = formatNumber(paidDays, Number.isInteger(paidDays) ? 0 : 1)
  return `${paid} of ${plural(expectedWorkdays, 'day')}`
}

/**
 * Used only when the server has no payrollPeriodPreview yet: a rough
 * estimate from the latest compensation profile of each active employee.
 */
export function buildLocalPreview(
  periodMonth: string,
  employees: PayrollEmployee[],
  compensations: CompensationProfile[],
): PayrollPreview {
  const activeEmployees = employees.filter((employee) => employee.isActive !== false)
  const latestByEmployee = new Map<string, CompensationProfile>()
  for (const profile of compensations) {
    const existing = latestByEmployee.get(profile.employeeId)
    if (!existing || existing.effectiveFrom < profile.effectiveFrom) {
      latestByEmployee.set(profile.employeeId, profile)
    }
  }

  let gross = 0
  let net = 0
  const missing: string[] = []
  let currencyCode = 'AED'

  for (const employee of activeEmployees) {
    const profile = latestByEmployee.get(employee.id)
    if (!profile) {
      missing.push(employee.fullName)
      continue
    }
    currencyCode = profile.currencyCode || currencyCode
    const employeeGross = profile.baseSalary + profile.allowanceAmount
    gross += employeeGross
    net += employeeGross - profile.deductionAmount
  }

  return {
    periodMonth,
    employeeCount: activeEmployees.length,
    missingCompensationCount: missing.length,
    missingCompensationNames: missing,
    estimatedGross: gross,
    estimatedNet: net,
    currencyCode,
    warnings: [],
  }
}
