import { FormEvent, useDeferredValue, useState } from 'react'
import { gql, useMutation, useQuery } from '@apollo/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Building2, Plus, Search, ShieldCheck, Users } from 'lucide-react'
import { MetricCard } from '@/components/ui/metric-card'
import { Notice } from '@/components/ui/notice'
import { StatusBadge } from '@/components/ui/status-badge'
import { canManageAccounts, readStoredAdminAccount } from '@/lib/auth-session'

const EMPLOYEE_PAGE_QUERY = gql`
  query EmployeePageData($filter: EmployeeFilterInput) {
    departments {
      id
      name
      code
    }
    designations {
      id
      title
      code
      departmentId
      level
      department {
        id
        name
      }
    }
    employees(filter: $filter) {
      id
      employeeNumber
      firstName
      lastName
      fullName
      email
      phone
      employmentType
      joinDate
      status
      hasLinkedAccount
      linkedAccountEmail
      linkedAccountRoles
      departmentId
      designationId
      department {
        id
        name
      }
      designation {
        id
        title
      }
    }
  }
`

const CREATE_DEPARTMENT_MUTATION = gql`
  mutation CreateDepartment($input: CreateDepartmentInput!) {
    createDepartment(input: $input) {
      id
    }
  }
`

const CREATE_DESIGNATION_MUTATION = gql`
  mutation CreateDesignation($input: CreateDesignationInput!) {
    createDesignation(input: $input) {
      id
    }
  }
`

const CREATE_EMPLOYEE_MUTATION = gql`
  mutation CreateEmployee($input: CreateEmployeeInput!) {
    createEmployee(input: $input) {
      id
    }
  }
`

const CREATE_EMPLOYEE_ACCOUNT_MUTATION = gql`
  mutation CreateEmployeeAccount($input: CreateEmployeeAccountInput!) {
    createEmployeeAccount(input: $input) {
      account {
        id
      }
    }
  }
`

const PROVISION_STAFF_ACCESS_MUTATION = gql`
  mutation ProvisionStaffAccess($input: ProvisionStaffAccessInput!) {
    provisionStaffAccess(input: $input) {
      id
      roles
    }
  }
`

type DepartmentFormState = {
  name: string
  code: string
  description: string
}

type DesignationFormState = {
  title: string
  code: string
  departmentId: string
  level: string
  description: string
}

type EmployeeFormState = {
  firstName: string
  lastName: string
  email: string
  phone: string
  departmentId: string
  designationId: string
  employmentType: string
  joinDate: string
}

type EmployeeAccountFormState = {
  employeeId: string
  password: string
}

type StaffAccessFormState = {
  employeeId: string
  roleKey: string
  password: string
}

const departmentFormDefaults: DepartmentFormState = {
  name: '',
  code: '',
  description: '',
}

const designationFormDefaults: DesignationFormState = {
  title: '',
  code: '',
  departmentId: '',
  level: '1',
  description: '',
}

const employeeFormDefaults: EmployeeFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  departmentId: '',
  designationId: '',
  employmentType: 'FULL_TIME',
  joinDate: new Date().toISOString().slice(0, 10),
}

const employeeAccountFormDefaults: EmployeeAccountFormState = {
  employeeId: '',
  password: '',
}

const staffAccessFormDefaults: StaffAccessFormState = {
  employeeId: '',
  roleKey: 'MANAGER',
  password: '',
}

export function EmployeesPage() {
  const currentAdminAccount = readStoredAdminAccount()
  const accountManagerAccess = canManageAccounts(currentAdminAccount?.roles ?? [])
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearch = useDeferredValue(searchQuery)
  const [showForms, setShowForms] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [departmentForm, setDepartmentForm] = useState(departmentFormDefaults)
  const [designationForm, setDesignationForm] = useState(designationFormDefaults)
  const [employeeForm, setEmployeeForm] = useState(employeeFormDefaults)
  const [employeeAccountForm, setEmployeeAccountForm] = useState(employeeAccountFormDefaults)
  const [staffAccessForm, setStaffAccessForm] = useState(staffAccessFormDefaults)

  const { data, loading, error, refetch } = useQuery(EMPLOYEE_PAGE_QUERY, {
    variables: {
      filter: deferredSearch.trim()
        ? {
            search: deferredSearch.trim(),
          }
        : null,
    },
  })

  const [createDepartment, { loading: creatingDepartment }] = useMutation(
    CREATE_DEPARTMENT_MUTATION
  )
  const [createDesignation, { loading: creatingDesignation }] = useMutation(
    CREATE_DESIGNATION_MUTATION
  )
  const [createEmployee, { loading: creatingEmployee }] = useMutation(
    CREATE_EMPLOYEE_MUTATION
  )
  const [createEmployeeAccount, { loading: creatingEmployeeAccount }] = useMutation(
    CREATE_EMPLOYEE_ACCOUNT_MUTATION
  )
  const [provisionStaffAccess, { loading: provisioningStaffAccess }] = useMutation(
    PROVISION_STAFF_ACCESS_MUTATION
  )

  const departments = data?.departments ?? []
  const designations = data?.designations ?? []
  const employees = data?.employees ?? []
  const linkedAccountsCount = employees.filter(
    (employee: { hasLinkedAccount: boolean }) => employee.hasLinkedAccount
  ).length
  const activeEmployeesCount = employees.filter(
    (employee: { status: string }) => employee.status === 'ACTIVE'
  ).length

  const employeeDesignationOptions = employeeForm.departmentId
    ? designations.filter(
        (designation: { departmentId: string }) =>
          designation.departmentId === employeeForm.departmentId
      )
    : designations

  const selectedEmployeeForAccount = employees.find(
    (employee: { id: string }) => employee.id === employeeAccountForm.employeeId
  )
  const selectedEmployeeForStaffAccess = employees.find(
    (employee: { id: string }) => employee.id === staffAccessForm.employeeId
  )
  const selectedStaffEmployeeHasLinkedAccount = Boolean(
    selectedEmployeeForStaffAccess?.hasLinkedAccount
  )

  const handleCreateDepartment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await createDepartment({
        variables: {
          input: {
            name: departmentForm.name,
            code: departmentForm.code,
            description: departmentForm.description || null,
          },
        },
      })
      setDepartmentForm(departmentFormDefaults)
      setStatusMessage('Department created.')
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to create department.'
      )
    }
  }

  const handleCreateDesignation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await createDesignation({
        variables: {
          input: {
            title: designationForm.title,
            code: designationForm.code,
            departmentId: designationForm.departmentId,
            level: Number.parseInt(designationForm.level || '1', 10),
            description: designationForm.description || null,
          },
        },
      })
      setDesignationForm((current) => ({
        ...designationFormDefaults,
        departmentId: current.departmentId,
      }))
      setStatusMessage('Designation created.')
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to create designation.'
      )
    }
  }

  const handleCreateEmployee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await createEmployee({
        variables: {
          input: {
            firstName: employeeForm.firstName,
            lastName: employeeForm.lastName,
            email: employeeForm.email,
            phone: employeeForm.phone || null,
            departmentId: employeeForm.departmentId,
            designationId: employeeForm.designationId,
            employmentType: employeeForm.employmentType,
            joinDate: employeeForm.joinDate,
          },
        },
      })
      setEmployeeForm(employeeFormDefaults)
      setStatusMessage('Employee created.')
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to create employee.'
      )
    }
  }

  const handleCreateEmployeeAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await createEmployeeAccount({
        variables: {
          input: {
            employeeId: employeeAccountForm.employeeId,
            password: employeeAccountForm.password,
          },
        },
      })
      setEmployeeAccountForm(employeeAccountFormDefaults)
      setStatusMessage('Employee account created.')
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to create employee account.'
      )
    }
  }

  const handleProvisionStaffAccess = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await provisionStaffAccess({
        variables: {
          input: {
            employeeId: staffAccessForm.employeeId,
            roleKey: staffAccessForm.roleKey,
            password: selectedStaffEmployeeHasLinkedAccount
              ? null
              : staffAccessForm.password,
          },
        },
      })
      setStaffAccessForm(staffAccessFormDefaults)
      setStatusMessage('Staff access provisioned.')
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to provision staff access.'
      )
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
          <div>
            <p className="app-kicker">Workforce setup</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
              Keep people records clean and easy to scan.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Search first, then open setup only when you need to create departments, roles, or accounts.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-[280px]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search employees"
                className="pl-11"
              />
            </div>
            <Button onClick={() => setShowForms((current) => !current)}>
              <Plus className="mr-2 h-4 w-4" />
              {showForms ? 'Hide setup' : 'Add records'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail="All employee records"
          icon={Users}
          label="Employees"
          tone="bg-sky-100 text-sky-800"
          value={String(employees.length)}
        />
        <MetricCard
          detail="Ready for daily operations"
          icon={ShieldCheck}
          label="Active"
          tone="bg-emerald-100 text-emerald-800"
          value={String(activeEmployeesCount)}
        />
        <MetricCard
          detail="Configured teams"
          icon={Building2}
          label="Departments"
          tone="bg-amber-100 text-amber-800"
          value={String(departments.length)}
        />
        <MetricCard
          detail="Linked mobile/admin access"
          icon={ShieldCheck}
          label="Accounts linked"
          tone="bg-violet-100 text-violet-800"
          value={String(linkedAccountsCount)}
        />
      </div>

      {errorMessage ? <Notice tone="danger">{errorMessage}</Notice> : null}
      {statusMessage ? <Notice tone="success">{statusMessage}</Notice> : null}

      {showForms && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Department Setup</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleCreateDepartment}>
                <div className="space-y-2">
                  <Label htmlFor="department-name">Department Name</Label>
                  <Input
                    id="department-name"
                    value={departmentForm.name}
                    onChange={(event) =>
                      setDepartmentForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Engineering"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department-code">Department Code</Label>
                  <Input
                    id="department-code"
                    value={departmentForm.code}
                    onChange={(event) =>
                      setDepartmentForm((current) => ({
                        ...current,
                        code: event.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="ENG"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department-description">Description</Label>
                  <Input
                    id="department-description"
                    value={departmentForm.description}
                    onChange={(event) =>
                      setDepartmentForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Optional"
                  />
                </div>
                <Button className="w-full" type="submit" disabled={creatingDepartment}>
                  {creatingDepartment ? 'Saving...' : 'Create Department'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Designation Setup</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleCreateDesignation}>
                <div className="space-y-2">
                  <Label htmlFor="designation-title">Designation Title</Label>
                  <Input
                    id="designation-title"
                    value={designationForm.title}
                    onChange={(event) =>
                      setDesignationForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    placeholder="Senior Engineer"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="designation-code">Designation Code</Label>
                  <Input
                    id="designation-code"
                    value={designationForm.code}
                    onChange={(event) =>
                      setDesignationForm((current) => ({
                        ...current,
                        code: event.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="SENIOR_ENGINEER"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="designation-department">Department</Label>
                  <select
                    id="designation-department"
                    value={designationForm.departmentId}
                    onChange={(event) =>
                      setDesignationForm((current) => ({
                        ...current,
                        departmentId: event.target.value,
                      }))
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Select department</option>
                    {departments.map((department: { id: string; name: string }) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="designation-level">Level</Label>
                  <Input
                    id="designation-level"
                    type="number"
                    min="1"
                    value={designationForm.level}
                    onChange={(event) =>
                      setDesignationForm((current) => ({
                        ...current,
                        level: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <Button
                  className="w-full"
                  type="submit"
                  disabled={creatingDesignation || departments.length === 0}
                >
                  {creatingDesignation ? 'Saving...' : 'Create Designation'}
                </Button>
                {departments.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Create at least one department before adding designations.
                  </p>
                )}
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Create Employee</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleCreateEmployee}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="employee-first-name">First Name</Label>
                    <Input
                      id="employee-first-name"
                      value={employeeForm.firstName}
                      onChange={(event) =>
                        setEmployeeForm((current) => ({
                          ...current,
                          firstName: event.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employee-last-name">Last Name</Label>
                    <Input
                      id="employee-last-name"
                      value={employeeForm.lastName}
                      onChange={(event) =>
                        setEmployeeForm((current) => ({
                          ...current,
                          lastName: event.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employee-email">Email</Label>
                  <Input
                    id="employee-email"
                    type="email"
                    value={employeeForm.email}
                    onChange={(event) =>
                      setEmployeeForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employee-phone">Phone</Label>
                  <Input
                    id="employee-phone"
                    value={employeeForm.phone}
                    onChange={(event) =>
                      setEmployeeForm((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="employee-department">Department</Label>
                    <select
                      id="employee-department"
                      value={employeeForm.departmentId}
                      onChange={(event) =>
                        setEmployeeForm((current) => ({
                          ...current,
                          departmentId: event.target.value,
                          designationId: '',
                        }))
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      required
                    >
                      <option value="">Select department</option>
                      {departments.map((department: { id: string; name: string }) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employee-designation">Designation</Label>
                    <select
                      id="employee-designation"
                      value={employeeForm.designationId}
                      onChange={(event) =>
                        setEmployeeForm((current) => ({
                          ...current,
                          designationId: event.target.value,
                        }))
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      required
                    >
                      <option value="">Select designation</option>
                      {employeeDesignationOptions.map(
                        (designation: { id: string; title: string }) => (
                          <option key={designation.id} value={designation.id}>
                            {designation.title}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="employee-employment-type">Employment Type</Label>
                    <select
                      id="employee-employment-type"
                      value={employeeForm.employmentType}
                      onChange={(event) =>
                        setEmployeeForm((current) => ({
                          ...current,
                          employmentType: event.target.value,
                        }))
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="FULL_TIME">Full Time</option>
                      <option value="PART_TIME">Part Time</option>
                      <option value="CONTRACT">Contract</option>
                      <option value="INTERNSHIP">Internship</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employee-join-date">Join Date</Label>
                    <Input
                      id="employee-join-date"
                      type="date"
                      value={employeeForm.joinDate}
                      onChange={(event) =>
                        setEmployeeForm((current) => ({
                          ...current,
                          joinDate: event.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                </div>
                <Button
                  className="w-full"
                  type="submit"
                  disabled={
                    creatingEmployee ||
                    departments.length === 0 ||
                    designations.length === 0
                  }
                >
                  {creatingEmployee ? 'Saving...' : 'Create Employee'}
                </Button>
                {(departments.length === 0 || designations.length === 0) && (
                  <p className="text-xs text-muted-foreground">
                    Add at least one department and designation before creating employees.
                  </p>
                )}
              </form>
            </CardContent>
          </Card>

          {accountManagerAccess && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Employee Account</CardTitle>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={handleCreateEmployeeAccount}>
                    <div className="space-y-2">
                      <Label htmlFor="employee-account-employee">Employee</Label>
                      <select
                        id="employee-account-employee"
                        value={employeeAccountForm.employeeId}
                        onChange={(event) =>
                          setEmployeeAccountForm((current) => ({
                            ...current,
                            employeeId: event.target.value,
                          }))
                        }
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        required
                      >
                        <option value="">Select employee</option>
                        {employees
                          .filter((employee: { hasLinkedAccount: boolean }) => !employee.hasLinkedAccount)
                          .map(
                            (employee: {
                              id: string
                              fullName: string
                              employeeNumber: string
                              email: string
                            }) => (
                              <option key={employee.id} value={employee.id}>
                                {employee.fullName} ({employee.employeeNumber}) • {employee.email}
                              </option>
                            )
                          )}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employee-account-password">Temporary Password</Label>
                      <Input
                        id="employee-account-password"
                        type="password"
                        value={employeeAccountForm.password}
                        onChange={(event) =>
                          setEmployeeAccountForm((current) => ({
                            ...current,
                            password: event.target.value,
                          }))
                        }
                        placeholder="Minimum 8 characters"
                        required
                      />
                    </div>
                    <Button
                      className="w-full"
                      type="submit"
                      disabled={creatingEmployeeAccount || employees.length === 0}
                    >
                      {creatingEmployeeAccount ? 'Saving...' : 'Create Employee Account'}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      The account is linked directly to the employee record so mobile sign-in resolves
                      the employee explicitly.
                    </p>
                    {selectedEmployeeForAccount?.hasLinkedAccount && (
                      <p className="text-xs text-muted-foreground">
                        This employee already has a linked account.
                      </p>
                    )}
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Staff & Admin Access</CardTitle>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={handleProvisionStaffAccess}>
                    <div className="space-y-2">
                      <Label htmlFor="staff-access-employee">Employee</Label>
                      <select
                        id="staff-access-employee"
                        value={staffAccessForm.employeeId}
                        onChange={(event) =>
                          setStaffAccessForm((current) => ({
                            ...current,
                            employeeId: event.target.value,
                          }))
                        }
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        required
                      >
                        <option value="">Select employee</option>
                        {employees.map(
                          (employee: {
                            id: string
                            fullName: string
                            employeeNumber: string
                            email: string
                            linkedAccountRoles: string[]
                          }) => (
                            <option key={employee.id} value={employee.id}>
                              {employee.fullName} ({employee.employeeNumber}) • {employee.email}
                              {employee.linkedAccountRoles.length > 0
                                ? ` • ${employee.linkedAccountRoles.join(', ')}`
                                : ''}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="staff-access-role">Admin Panel Role</Label>
                      <select
                        id="staff-access-role"
                        value={staffAccessForm.roleKey}
                        onChange={(event) =>
                          setStaffAccessForm((current) => ({
                            ...current,
                            roleKey: event.target.value,
                          }))
                        }
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        required
                      >
                        <option value="MANAGER">Manager</option>
                        <option value="SUPERVISOR">Supervisor</option>
                        <option value="HR_ADMIN">HR Admin</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </div>
                    {!selectedStaffEmployeeHasLinkedAccount && (
                      <div className="space-y-2">
                        <Label htmlFor="staff-access-password">Temporary Password</Label>
                        <Input
                          id="staff-access-password"
                          type="password"
                          value={staffAccessForm.password}
                          onChange={(event) =>
                            setStaffAccessForm((current) => ({
                              ...current,
                              password: event.target.value,
                            }))
                          }
                          placeholder="Required when creating a new linked account"
                          required={!selectedStaffEmployeeHasLinkedAccount}
                        />
                      </div>
                    )}
                    <Button
                      className="w-full"
                      type="submit"
                      disabled={provisioningStaffAccess || employees.length === 0}
                    >
                      {provisioningStaffAccess ? 'Saving...' : 'Provision Staff Access'}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      This grants admin panel access to the employee&apos;s linked account. If the
                      employee has no account yet, a linked account is created first.
                    </p>
                    {selectedEmployeeForStaffAccess?.linkedAccountRoles?.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Current roles: {selectedEmployeeForStaffAccess.linkedAccountRoles.join(', ')}
                      </p>
                    )}
                  </form>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <p className="app-kicker">Roster</p>
          <CardTitle>Employee List</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading employees...</p>
          ) : error ? (
            <Notice tone="danger">Unable to load employee data. {error.message}</Notice>
          ) : employees.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No employees found yet. Use “Add Records” to create the first team.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left">Employee #</th>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Department</th>
                    <th className="px-4 py-3 text-left">Designation</th>
                    <th className="px-4 py-3 text-left">Login</th>
                    <th className="px-4 py-3 text-left">Join Date</th>
                    <th className="px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map(
                    (employee: {
                      id: string
                      employeeNumber: string
                      fullName: string
                      email: string
                      hasLinkedAccount: boolean
                      linkedAccountEmail?: string | null
                      linkedAccountRoles: string[]
                      joinDate: string
                      status: string
                      department: { name: string }
                      designation: { title: string }
                    }) => (
                      <tr key={employee.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{employee.employeeNumber}</td>
                        <td className="px-4 py-3">{employee.fullName}</td>
                        <td className="px-4 py-3">{employee.email}</td>
                        <td className="px-4 py-3">{employee.department.name}</td>
                        <td className="px-4 py-3">{employee.designation.title}</td>
                        <td className="px-4 py-3">
                          {employee.hasLinkedAccount ? (
                            <div className="space-y-2">
                              <StatusBadge tone="info">
                                {employee.linkedAccountEmail || 'Linked'}
                              </StatusBadge>
                              {employee.linkedAccountRoles.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {employee.linkedAccountRoles.map((role) => (
                                    <StatusBadge key={role} tone="neutral">
                                      {role}
                                    </StatusBadge>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <StatusBadge tone="warning">No login</StatusBadge>
                          )}
                        </td>
                        <td className="px-4 py-3">{employee.joinDate}</td>
                        <td className="px-4 py-3">
                          <StatusBadge tone="success">
                            {employee.status}
                          </StatusBadge>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
