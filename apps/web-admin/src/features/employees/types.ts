import { todayLocal } from '@/lib/format'

export type Person = {
  id: string
  employeeNumber: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  phone?: string | null
  employmentType: string
  joinDate: string
  exitDate?: string | null
  status: string
  isActive: boolean
  supervisorId?: string | null
  supervisorName?: string | null
  hasLinkedAccount: boolean
  linkedAccountEmail?: string | null
  linkedAccountRoles: string[]
  departmentId: string
  designationId: string
  department: { id: string; name: string }
  designation: { id: string; title: string }
}

export type Compensation = {
  id: string
  employeeId: string
  baseSalary: number
  allowanceAmount: number
  deductionAmount: number
  currencyCode: string
  effectiveFrom: string
}

export type ProfileForm = {
  firstName: string
  lastName: string
  email: string
  phone: string
  departmentId: string
  designationId: string
  supervisorId: string
  joinDate: string
  employmentType: string
  status: string
}

export type PayForm = {
  baseSalary: string
  allowanceAmount: string
  deductionAmount: string
  currencyCode: string
  effectiveFrom: string
}

export type SiteForm = {
  locationId: string
  isPrimary: boolean
}

export type SignInForm = {
  createSignIn: boolean
  password: string
  staffRole: string
}

export const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP']
export const EMPLOYEE_STATUSES = ['ACTIVE', 'ON_LEAVE', 'INACTIVE']
export const STAFF_ROLES = ['MANAGER', 'SUPERVISOR', 'HR_ADMIN', 'ADMIN']

export function emptyProfile(): ProfileForm {
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    departmentId: '',
    designationId: '',
    supervisorId: '',
    joinDate: todayLocal(),
    employmentType: 'FULL_TIME',
    status: 'ACTIVE',
  }
}

export function profileFromPerson(person: Person): ProfileForm {
  return {
    firstName: person.firstName,
    lastName: person.lastName,
    email: person.email,
    phone: person.phone ?? '',
    departmentId: person.departmentId,
    designationId: person.designationId,
    supervisorId: person.supervisorId ?? '',
    joinDate: person.joinDate,
    employmentType: person.employmentType,
    status: person.status,
  }
}

export function emptyPay(currencyCode: string, effectiveFrom = todayLocal()): PayForm {
  return {
    baseSalary: '',
    allowanceAmount: '',
    deductionAmount: '',
    currencyCode,
    effectiveFrom,
  }
}

export function payFromCompensation(compensation: Compensation): PayForm {
  return {
    baseSalary: String(compensation.baseSalary),
    allowanceAmount: compensation.allowanceAmount ? String(compensation.allowanceAmount) : '',
    deductionAmount: compensation.deductionAmount ? String(compensation.deductionAmount) : '',
    currencyCode: compensation.currencyCode,
    effectiveFrom: compensation.effectiveFrom.slice(0, 10),
  }
}

// Which staff roles the signed-in viewer may grant. HR admins can grant
// manager and supervisor; full admins can grant any staff role.
export function grantableRoles(viewerRoles: string[]): string[] {
  if (viewerRoles.includes('ADMIN')) return STAFF_ROLES
  if (viewerRoles.includes('HR_ADMIN')) return ['MANAGER', 'SUPERVISOR']
  return []
}

export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()
}

export function signInLabel(person: Person) {
  if (!person.hasLinkedAccount) return null
  const staff = person.linkedAccountRoles.filter((role) => role !== 'EMPLOYEE')
  return staff.length ? staff : ['EMPLOYEE']
}

export function employeeStatusTone(status: string) {
  if (status === 'ACTIVE') return 'success' as const
  if (status === 'ON_LEAVE') return 'warning' as const
  return 'neutral' as const
}
