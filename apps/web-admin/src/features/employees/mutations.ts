import { useMutation } from '@apollo/client'

import {
  ASSIGN_SITE_MUTATION,
  CREATE_EMPLOYEE_ACCOUNT_MUTATION,
  CREATE_EMPLOYEE_MUTATION,
  PEOPLE_REFETCH,
  PROVISION_STAFF_ACCESS_MUTATION,
  UPDATE_EMPLOYEE_MUTATION,
  UPSERT_COMPENSATION_MUTATION,
} from './graphql'
import type { PayForm, ProfileForm, SignInForm, SiteForm } from './types'

/* ----------------------------------------------------------------------------
 * Mutations shared by the guided drawer and the single-purpose drawers.
 * Each returns the created/updated id and throws on failure.
 * ------------------------------------------------------------------------- */

export function useEmployeeMutations() {
  const options = { refetchQueries: PEOPLE_REFETCH }
  const [createEmployee] = useMutation(CREATE_EMPLOYEE_MUTATION, options)
  const [updateEmployee] = useMutation(UPDATE_EMPLOYEE_MUTATION, options)
  const [upsertCompensation] = useMutation(UPSERT_COMPENSATION_MUTATION, {
    refetchQueries: ['EmployeeCompensations'],
  })
  const [assignSite] = useMutation(ASSIGN_SITE_MUTATION)
  const [createAccount] = useMutation(CREATE_EMPLOYEE_ACCOUNT_MUTATION, options)
  const [provisionStaff] = useMutation(PROVISION_STAFF_ACCESS_MUTATION, options)

  return {
    async saveProfile(form: ProfileForm, employeeId?: string | null) {
      const input = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        departmentId: form.departmentId,
        designationId: form.designationId,
        supervisorId: form.supervisorId || (employeeId ? '' : null),
        employmentType: form.employmentType,
        joinDate: form.joinDate,
        status: form.status,
      }
      if (employeeId) {
        await updateEmployee({ variables: { input: { id: employeeId, ...input } } })
        return employeeId
      }
      const result = await createEmployee({ variables: { input } })
      return result.data.createEmployee.id as string
    },
    async savePay(employeeId: string, form: PayForm) {
      await upsertCompensation({
        variables: {
          input: {
            employeeId,
            baseSalary: Number.parseFloat(form.baseSalary),
            allowanceAmount: parseAmount(form.allowanceAmount),
            deductionAmount: parseAmount(form.deductionAmount),
            currencyCode: form.currencyCode.trim().toUpperCase() || null,
            effectiveFrom: form.effectiveFrom || null,
          },
        },
      })
    },
    async saveSite(employeeId: string, form: SiteForm) {
      await assignSite({
        variables: {
          input: { employeeId, locationId: form.locationId, isPrimary: form.isPrimary },
        },
      })
    },
    async saveSignIn(employeeId: string, form: SignInForm, hasAccount: boolean) {
      if (form.staffRole) {
        await provisionStaff({
          variables: {
            input: {
              employeeId,
              roleKey: form.staffRole,
              password: hasAccount ? null : form.password,
            },
          },
        })
        return
      }
      if (form.createSignIn && !hasAccount) {
        await createAccount({ variables: { input: { employeeId, password: form.password } } })
      }
    },
  }
}

function parseAmount(value: string) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/* ----------------------------------------------------------------------------
 * Validation (client side, before the API is called)
 * ------------------------------------------------------------------------- */

export type ProfileErrors = Partial<Record<keyof ProfileForm, string>>

// Field-level messages so each problem shows under its own input.
export function profileFieldErrors(form: ProfileForm): ProfileErrors {
  const errors: ProfileErrors = {}
  if (!form.firstName.trim()) errors.firstName = 'Enter the first name.'
  if (!form.lastName.trim()) errors.lastName = 'Enter the last name.'
  if (!form.email.trim()) errors.email = 'Enter a work email.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Enter a valid email, like name@company.com.'
  if (!form.departmentId) errors.departmentId = 'Choose a department.'
  if (!form.designationId) errors.designationId = form.departmentId ? 'Choose a designation.' : 'Choose a department first.'
  if (!form.joinDate) errors.joinDate = 'Enter the join date.'
  return errors
}

const PROFILE_FIELD_IDS: Partial<Record<keyof ProfileForm, string>> = {
  firstName: 'profile-first-name',
  lastName: 'profile-last-name',
  email: 'profile-email',
  departmentId: 'profile-department',
  designationId: 'profile-designation',
  joinDate: 'profile-join-date',
}

export function focusFirstProfileError(errors: ProfileErrors) {
  const first = (Object.keys(PROFILE_FIELD_IDS) as (keyof ProfileForm)[]).find((key) => errors[key])
  if (first) document.getElementById(PROFILE_FIELD_IDS[first] ?? '')?.focus()
}

export function validateProfile(form: ProfileForm): string | null {
  if (!form.firstName.trim() || !form.lastName.trim()) return 'Enter the first and last name.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Enter a valid work email.'
  if (!form.departmentId) return 'Choose a department.'
  if (!form.designationId) return 'Choose a designation.'
  if (!form.joinDate) return 'Enter the join date.'
  return null
}

export function validatePay(form: PayForm): string | null {
  const base = Number.parseFloat(form.baseSalary)
  if (!Number.isFinite(base) || base <= 0) return 'Enter a base salary above zero.'
  for (const [label, value] of [
    ['Allowance', form.allowanceAmount],
    ['Monthly deductions', form.deductionAmount],
  ] as const) {
    if (value.trim() && (!Number.isFinite(Number.parseFloat(value)) || Number.parseFloat(value) < 0)) {
      return `${label} must be zero or more.`
    }
  }
  if (!/^[A-Za-z]{3}$/.test(form.currencyCode.trim())) return 'Use a three-letter currency code, for example AED.'
  return null
}

export function validateSignIn(form: SignInForm, hasAccount: boolean): string | null {
  const needsPassword = !hasAccount && (form.createSignIn || Boolean(form.staffRole))
  if (needsPassword && form.password.trim().length < 8) {
    return 'The temporary password needs at least 8 characters.'
  }
  return null
}


export function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const values = new Uint32Array(12)
  crypto.getRandomValues(values)
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join('')
}
