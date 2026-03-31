import { FormEvent, useDeferredValue, useState } from 'react'
import { gql, useMutation, useQuery } from '@apollo/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Search } from 'lucide-react'

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
      hasUserAccount
      userAccountEmail
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

const CREATE_EMPLOYEE_USER_MUTATION = gql`
  mutation CreateEmployeeUser($input: CreateEmployeeUserInput!) {
    createEmployeeUser(input: $input) {
      user {
        id
      }
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

type EmployeeUserFormState = {
  employeeId: string
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

const employeeUserFormDefaults: EmployeeUserFormState = {
  employeeId: '',
  password: '',
}

export function EmployeesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearch = useDeferredValue(searchQuery)
  const [showForms, setShowForms] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [departmentForm, setDepartmentForm] = useState(departmentFormDefaults)
  const [designationForm, setDesignationForm] = useState(designationFormDefaults)
  const [employeeForm, setEmployeeForm] = useState(employeeFormDefaults)
  const [employeeUserForm, setEmployeeUserForm] = useState(employeeUserFormDefaults)

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
  const [createEmployeeUser, { loading: creatingEmployeeUser }] = useMutation(
    CREATE_EMPLOYEE_USER_MUTATION
  )

  const departments = data?.departments ?? []
  const designations = data?.designations ?? []
  const employees = data?.employees ?? []

  const employeeDesignationOptions = employeeForm.departmentId
    ? designations.filter(
        (designation: { departmentId: string }) =>
          designation.departmentId === employeeForm.departmentId
      )
    : designations

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

  const handleCreateEmployeeUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await createEmployeeUser({
        variables: {
          input: {
            employeeId: employeeUserForm.employeeId,
            password: employeeUserForm.password,
          },
        },
      })
      setEmployeeUserForm(employeeUserFormDefaults)
      setStatusMessage('Employee login created.')
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to create employee login.'
      )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Employees</h1>
          <p className="text-muted-foreground">
            Create departments, designations, and employees from the real backend.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-[260px]">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search employees"
              className="pl-10"
            />
          </div>
          <Button onClick={() => setShowForms((current) => !current)}>
            <Plus className="mr-2 h-4 w-4" />
            {showForms ? 'Hide Setup' : 'Add Records'}
          </Button>
        </div>
      </div>

      {errorMessage && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">{errorMessage}</CardContent>
        </Card>
      )}

      {statusMessage && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4 text-sm text-emerald-700">
            {statusMessage}
          </CardContent>
        </Card>
      )}

      {showForms && (
        <div className="grid gap-6 xl:grid-cols-2">
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

          <Card>
            <CardHeader>
              <CardTitle>Employee Login</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleCreateEmployeeUser}>
                <div className="space-y-2">
                  <Label htmlFor="employee-user-employee">Employee</Label>
                  <select
                    id="employee-user-employee"
                    value={employeeUserForm.employeeId}
                    onChange={(event) =>
                      setEmployeeUserForm((current) => ({
                        ...current,
                        employeeId: event.target.value,
                      }))
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Select employee</option>
                    {employees
                      .filter((employee: { hasUserAccount: boolean }) => !employee.hasUserAccount)
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
                  <Label htmlFor="employee-user-password">Temporary Password</Label>
                  <Input
                    id="employee-user-password"
                    type="password"
                    value={employeeUserForm.password}
                    onChange={(event) =>
                      setEmployeeUserForm((current) => ({
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
                  disabled={creatingEmployeeUser || employees.length === 0}
                >
                  {creatingEmployeeUser ? 'Saving...' : 'Create Employee Login'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  The user account is linked directly to the employee record. Mobile login uses
                  this link instead of matching by email.
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Employee List</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading employees...</p>
          ) : error ? (
            <p className="text-sm text-red-600">
              Unable to load employee data. {error.message}
            </p>
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
                      hasUserAccount: boolean
                      userAccountEmail?: string | null
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
                          {employee.hasUserAccount ? (
                            <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                              {employee.userAccountEmail || 'Linked'}
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                              No login
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">{employee.joinDate}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                            {employee.status}
                          </span>
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
