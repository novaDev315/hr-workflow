import { FormEvent, useDeferredValue, useState } from 'react'
import { AdminTable, AdminTableEmpty, AdminTableRow } from '@/components/admin/admin-table'
import { PageFeedback } from '@/components/admin/page-feedback'
import { RecordCard } from '@/components/admin/record-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { FormDrawer } from '@/components/ui/form-drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Pencil, Plus, Search, UserX } from 'lucide-react'
import { Notice } from '@/components/ui/notice'
import { StatusBadge } from '@/components/ui/status-badge'
import { canManageAccounts, readStoredAdminAccount } from '@/lib/auth-session'
import { useEmployeeWorkspaceGraphql } from './hooks'
import {
  departmentFormDefaults,
  designationFormDefaults,
  employeeAccountFormDefaults,
  employeeFormDefaults,
  staffAccessFormDefaults,
} from './types'

export function EmployeesPage() {
  const currentAdminAccount = readStoredAdminAccount()
  const accountManagerAccess = canManageAccounts(currentAdminAccount)
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearch = useDeferredValue(searchQuery)
  const [showForms, setShowForms] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [departmentForm, setDepartmentForm] = useState(departmentFormDefaults)
  const [editingDepartmentId, setEditingDepartmentId] = useState<string | null>(null)
  const [designationForm, setDesignationForm] = useState(designationFormDefaults)
  const [editingDesignationId, setEditingDesignationId] = useState<string | null>(null)
  const [employeeForm, setEmployeeForm] = useState(employeeFormDefaults)
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null)
  const [employeeAccountForm, setEmployeeAccountForm] = useState(employeeAccountFormDefaults)
  const [staffAccessForm, setStaffAccessForm] = useState(staffAccessFormDefaults)

  const {
    data,
    loading,
    error,
    refetch,
    createDepartment,
    creatingDepartment,
    updateDepartment,
    updatingDepartment,
    deactivateDepartment,
    deactivatingDepartment,
    createDesignation,
    creatingDesignation,
    updateDesignation,
    updatingDesignation,
    deactivateDesignation,
    deactivatingDesignation,
    createEmployee,
    creatingEmployee,
    updateEmployee,
    updatingEmployee,
    deactivateEmployee,
    deactivatingEmployee,
    createEmployeeAccount,
    creatingEmployeeAccount,
    provisionStaffAccess,
    provisioningStaffAccess,
  } = useEmployeeWorkspaceGraphql(deferredSearch)

  const departments = data?.departments ?? []
  const designations = data?.designations ?? []
  const employees = data?.employees ?? []
  const activeDepartments = departments.filter(
    (department: { isActive: boolean }) => department.isActive
  )
  const activeDesignations = designations.filter(
    (designation: { isActive: boolean }) => designation.isActive
  )

  const employeeDesignationOptions = employeeForm.departmentId
    ? activeDesignations.filter(
        (designation: { departmentId: string }) =>
          designation.departmentId === employeeForm.departmentId
      )
    : activeDesignations

  const selectedEmployeeForAccount = employees.find(
    (employee: { id: string }) => employee.id === employeeAccountForm.employeeId
  )
  const selectedEmployeeForStaffAccess = employees.find(
    (employee: { id: string }) => employee.id === staffAccessForm.employeeId
  )
  const selectedStaffEmployeeHasLinkedAccount = Boolean(
    selectedEmployeeForStaffAccess?.hasLinkedAccount
  )

  const handleSaveDepartment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      const input = {
        name: departmentForm.name,
        code: departmentForm.code,
        description: departmentForm.description || null,
      }

      if (editingDepartmentId) {
        await updateDepartment({
          variables: {
            input: {
              id: editingDepartmentId,
              ...input,
            },
          },
        })
      } else {
        await createDepartment({
          variables: {
            input,
          },
        })
      }
      setDepartmentForm(departmentFormDefaults)
      setEditingDepartmentId(null)
      setStatusMessage(editingDepartmentId ? 'Department updated.' : 'Department created.')
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to save department.'
      )
    }
  }

  const handleEditDepartment = (department: {
    id: string
    name: string
    code: string
    description?: string | null
  }) => {
    setEditingDepartmentId(department.id)
    setDepartmentForm({
      name: department.name,
      code: department.code,
      description: department.description ?? '',
    })
    setErrorMessage(null)
    setStatusMessage(null)
  }

  const handleCancelDepartmentEdit = () => {
    setEditingDepartmentId(null)
    setDepartmentForm(departmentFormDefaults)
  }

  const handleDeactivateDepartment = async (departmentId: string, name: string) => {
    if (!window.confirm(`Deactivate ${name}? New employees cannot use it.`)) {
      return
    }

    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await deactivateDepartment({
        variables: {
          input: {
            id: departmentId,
          },
        },
      })
      setStatusMessage('Department deactivated.')
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to deactivate department.'
      )
    }
  }

  const handleSaveDesignation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      const input = {
        title: designationForm.title,
        code: designationForm.code,
        departmentId: designationForm.departmentId,
        level: Number.parseInt(designationForm.level || '1', 10),
        description: designationForm.description || null,
      }

      if (editingDesignationId) {
        await updateDesignation({
          variables: {
            input: {
              id: editingDesignationId,
              ...input,
            },
          },
        })
      } else {
        await createDesignation({
          variables: {
            input,
          },
        })
      }
      setDesignationForm((current) => ({
        ...designationFormDefaults,
        departmentId: current.departmentId,
      }))
      setEditingDesignationId(null)
      setStatusMessage(editingDesignationId ? 'Designation updated.' : 'Designation created.')
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to save designation.'
      )
    }
  }

  const handleEditDesignation = (designation: {
    id: string
    title: string
    code: string
    departmentId: string
    level: number
    description?: string | null
  }) => {
    setEditingDesignationId(designation.id)
    setDesignationForm({
      title: designation.title,
      code: designation.code,
      departmentId: designation.departmentId,
      level: String(designation.level),
      description: designation.description ?? '',
    })
    setErrorMessage(null)
    setStatusMessage(null)
  }

  const handleCancelDesignationEdit = () => {
    setEditingDesignationId(null)
    setDesignationForm(designationFormDefaults)
  }

  const handleDeactivateDesignation = async (designationId: string, title: string) => {
    if (!window.confirm(`Deactivate ${title}? New employees cannot use it.`)) {
      return
    }

    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await deactivateDesignation({
        variables: {
          input: {
            id: designationId,
          },
        },
      })
      setStatusMessage('Designation deactivated.')
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to deactivate designation.'
      )
    }
  }

  const handleSaveEmployee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      const input = {
        firstName: employeeForm.firstName,
        lastName: employeeForm.lastName,
        email: employeeForm.email,
        phone: employeeForm.phone || null,
        departmentId: employeeForm.departmentId,
        designationId: employeeForm.designationId,
        employmentType: employeeForm.employmentType,
        joinDate: employeeForm.joinDate,
        status: employeeForm.status,
      }

      if (editingEmployeeId) {
        await updateEmployee({
          variables: {
            input: {
              id: editingEmployeeId,
              ...input,
            },
          },
        })
      } else {
        await createEmployee({
          variables: {
            input,
          },
        })
      }
      setEmployeeForm(employeeFormDefaults)
      setEditingEmployeeId(null)
      setStatusMessage(editingEmployeeId ? 'Employee updated.' : 'Employee created.')
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to save employee.'
      )
    }
  }

  const handleEditEmployee = (employee: {
    id: string
    firstName: string
    lastName: string
    email: string
    phone?: string | null
    departmentId: string
    designationId: string
    employmentType: string
    joinDate: string
    status: string
  }) => {
    setShowForms(true)
    setEditingEmployeeId(employee.id)
    setEmployeeForm({
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      phone: employee.phone ?? '',
      departmentId: employee.departmentId,
      designationId: employee.designationId,
      employmentType: employee.employmentType,
      joinDate: employee.joinDate,
      status: employee.status,
    })
    setErrorMessage(null)
    setStatusMessage(null)
  }

  const handleCancelEmployeeEdit = () => {
    setEditingEmployeeId(null)
    setEmployeeForm(employeeFormDefaults)
  }

  const handleDeactivateEmployee = async (employeeId: string, fullName: string) => {
    if (!window.confirm(`Deactivate ${fullName}? Linked login access will also be disabled.`)) {
      return
    }

    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await deactivateEmployee({
        variables: {
          input: {
            id: employeeId,
          },
        },
      })
      setStatusMessage('Employee deactivated.')
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to deactivate employee.'
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

  const closeFormsDrawer = () => {
    setShowForms(false)
    handleCancelDepartmentEdit()
    handleCancelDesignationEdit()
    handleCancelEmployeeEdit()
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
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
            <Button onClick={() => setShowForms(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add records
            </Button>
          </div>
        </CardContent>
      </Card>

      <PageFeedback errorMessage={errorMessage} statusMessage={statusMessage} />

      <FormDrawer
        open={showForms}
        onOpenChange={(open) => {
          if (open) {
            setShowForms(true)
          } else {
            closeFormsDrawer()
          }
        }}
        kicker="People setup"
        title="Add and manage records"
        description="Create departments, designations, employees, and access without leaving the roster."
        className="sm:w-[min(1120px,calc(100vw-2rem))]"
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{editingDepartmentId ? 'Edit Department' : 'Department Setup'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSaveDepartment}>
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
                <Button
                  className="w-full"
                  type="submit"
                  disabled={creatingDepartment || updatingDepartment}
                >
                  {creatingDepartment || updatingDepartment
                    ? 'Saving...'
                    : editingDepartmentId
                      ? 'Update Department'
                      : 'Create Department'}
                </Button>
                {editingDepartmentId ? (
                  <Button
                    className="w-full"
                    type="button"
                    variant="outline"
                    onClick={handleCancelDepartmentEdit}
                  >
                    Cancel Edit
                  </Button>
                ) : null}
              </form>
              <div className="mt-5 space-y-2">
                {departments.map(
                  (department: {
                    id: string
                    name: string
                    code: string
                    description?: string | null
                    isActive: boolean
                  }) => (
                    <RecordCard key={department.id} className="p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">{department.name}</div>
                          <div className="text-muted-foreground">{department.code}</div>
                        </div>
                        <StatusBadge tone={department.isActive ? 'success' : 'neutral'}>
                          {department.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </StatusBadge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleEditDepartment(department)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        {department.isActive ? (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={deactivatingDepartment}
                            onClick={() =>
                              handleDeactivateDepartment(department.id, department.name)
                            }
                          >
                            <UserX className="mr-2 h-4 w-4" />
                            Deactivate
                          </Button>
                        ) : null}
                      </div>
                    </RecordCard>
                  )
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{editingDesignationId ? 'Edit Designation' : 'Designation Setup'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSaveDesignation}>
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
                <Field>
                  <FieldLabel htmlFor="designation-department">Department</FieldLabel>
                  <Select
                    name="designation-department"
                    value={designationForm.departmentId}
                    onValueChange={(departmentId) =>
                      setDesignationForm((current) => ({
                        ...current,
                        departmentId,
                      }))
                    }
                    required
                  >
                    <SelectTrigger id="designation-department">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeDepartments.map((department: { id: string; name: string }) => (
                        <SelectItem key={department.id} value={department.id}>
                          {department.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
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
                  disabled={
                    creatingDesignation ||
                    updatingDesignation ||
                    activeDepartments.length === 0
                  }
                >
                  {creatingDesignation || updatingDesignation
                    ? 'Saving...'
                    : editingDesignationId
                      ? 'Update Designation'
                      : 'Create Designation'}
                </Button>
                {editingDesignationId ? (
                  <Button
                    className="w-full"
                    type="button"
                    variant="outline"
                    onClick={handleCancelDesignationEdit}
                  >
                    Cancel Edit
                  </Button>
                ) : null}
                {activeDepartments.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Create at least one department before adding designations.
                  </p>
                )}
              </form>
              <div className="mt-5 space-y-2">
                {designations.map(
                  (designation: {
                    id: string
                    title: string
                    code: string
                    departmentId: string
                    level: number
                    description?: string | null
                    isActive: boolean
                  }) => (
                    <RecordCard key={designation.id} className="p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">{designation.title}</div>
                          <div className="text-muted-foreground">{designation.code}</div>
                        </div>
                        <StatusBadge tone={designation.isActive ? 'success' : 'neutral'}>
                          {designation.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </StatusBadge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleEditDesignation(designation)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        {designation.isActive ? (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={deactivatingDesignation}
                            onClick={() =>
                              handleDeactivateDesignation(designation.id, designation.title)
                            }
                          >
                            <UserX className="mr-2 h-4 w-4" />
                            Deactivate
                          </Button>
                        ) : null}
                      </div>
                    </RecordCard>
                  )
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{editingEmployeeId ? 'Edit Employee' : 'Create Employee'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSaveEmployee}>
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
                  <Field>
                    <FieldLabel htmlFor="employee-department">Department</FieldLabel>
                    <Select
                      name="employee-department"
                      value={employeeForm.departmentId}
                      onValueChange={(departmentId) =>
                        setEmployeeForm((current) => ({
                          ...current,
                          departmentId,
                          designationId: '',
                        }))
                      }
                      required
                    >
                      <SelectTrigger id="employee-department">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeDepartments.map((department: { id: string; name: string }) => (
                          <SelectItem key={department.id} value={department.id}>
                            {department.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="employee-designation">Designation</FieldLabel>
                    <Select
                      name="employee-designation"
                      value={employeeForm.designationId}
                      onValueChange={(designationId) =>
                        setEmployeeForm((current) => ({
                          ...current,
                          designationId,
                        }))
                      }
                      required
                    >
                      <SelectTrigger id="employee-designation">
                        <SelectValue placeholder="Select designation" />
                      </SelectTrigger>
                      <SelectContent>
                        {employeeDesignationOptions.map(
                          (designation: { id: string; title: string }) => (
                            <SelectItem key={designation.id} value={designation.id}>
                              {designation.title}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="employee-employment-type">Employment Type</FieldLabel>
                    <Select
                      name="employee-employment-type"
                      value={employeeForm.employmentType}
                      onValueChange={(employmentType) =>
                        setEmployeeForm((current) => ({
                          ...current,
                          employmentType,
                        }))
                      }
                    >
                      <SelectTrigger id="employee-employment-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FULL_TIME">Full Time</SelectItem>
                        <SelectItem value="PART_TIME">Part Time</SelectItem>
                        <SelectItem value="CONTRACT">Contract</SelectItem>
                        <SelectItem value="INTERNSHIP">Internship</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
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
                <Field>
                  <FieldLabel htmlFor="employee-status">Status</FieldLabel>
                  <Select
                    name="employee-status"
                    value={employeeForm.status}
                    onValueChange={(status) =>
                      setEmployeeForm((current) => ({
                        ...current,
                        status,
                      }))
                    }
                  >
                    <SelectTrigger id="employee-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Button
                  className="w-full"
                  type="submit"
                  disabled={
                    creatingEmployee ||
                    updatingEmployee ||
                    activeDepartments.length === 0 ||
                    activeDesignations.length === 0
                  }
                >
                  {creatingEmployee || updatingEmployee
                    ? 'Saving...'
                    : editingEmployeeId
                      ? 'Update Employee'
                      : 'Create Employee'}
                </Button>
                {editingEmployeeId ? (
                  <Button
                    className="w-full"
                    type="button"
                    variant="outline"
                    onClick={handleCancelEmployeeEdit}
                  >
                    Cancel Edit
                  </Button>
                ) : null}
                {(activeDepartments.length === 0 || activeDesignations.length === 0) && (
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
                    <Field>
                      <FieldLabel htmlFor="employee-account-employee">Employee</FieldLabel>
                      <Select
                        name="employee-account-employee"
                        value={employeeAccountForm.employeeId}
                        onValueChange={(employeeId) =>
                          setEmployeeAccountForm((current) => ({
                            ...current,
                            employeeId,
                          }))
                        }
                        required
                      >
                        <SelectTrigger id="employee-account-employee">
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees
                            .filter(
                              (employee: { hasLinkedAccount: boolean }) =>
                                !employee.hasLinkedAccount
                            )
                            .map(
                              (employee: {
                                id: string
                                fullName: string
                                employeeNumber: string
                                email: string
                              }) => (
                                <SelectItem key={employee.id} value={employee.id}>
                                  {employee.fullName} ({employee.employeeNumber}) • {employee.email}
                                </SelectItem>
                              )
                            )}
                        </SelectContent>
                      </Select>
                    </Field>
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
                    <Field>
                      <FieldLabel htmlFor="staff-access-employee">Employee</FieldLabel>
                      <Select
                        name="staff-access-employee"
                        value={staffAccessForm.employeeId}
                        onValueChange={(employeeId) =>
                          setStaffAccessForm((current) => ({
                            ...current,
                            employeeId,
                          }))
                        }
                        required
                      >
                        <SelectTrigger id="staff-access-employee">
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map(
                            (employee: {
                              id: string
                              fullName: string
                              employeeNumber: string
                              email: string
                              linkedAccountRoles: string[]
                            }) => (
                              <SelectItem key={employee.id} value={employee.id}>
                                {employee.fullName} ({employee.employeeNumber}) • {employee.email}
                                {employee.linkedAccountRoles.length > 0
                                  ? ` • ${employee.linkedAccountRoles.join(', ')}`
                                  : ''}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="staff-access-role">Admin Panel Role</FieldLabel>
                      <Select
                        name="staff-access-role"
                        value={staffAccessForm.roleKey}
                        onValueChange={(roleKey) =>
                          setStaffAccessForm((current) => ({
                            ...current,
                            roleKey,
                          }))
                        }
                        required
                      >
                        <SelectTrigger id="staff-access-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MANAGER">Manager</SelectItem>
                          <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                          <SelectItem value="HR_ADMIN">HR Admin</SelectItem>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
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
      </FormDrawer>

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
            <AdminTableEmpty>
              No employees found yet. Use “Add Records” to create the first team.
            </AdminTableEmpty>
          ) : (
            <AdminTable>
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
                    {accountManagerAccess ? (
                      <th className="px-4 py-3 text-left">Actions</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {employees.map(
                    (employee: {
                      id: string
                      employeeNumber: string
                      fullName: string
                      email: string
                      phone?: string | null
                      firstName: string
                      lastName: string
                      departmentId: string
                      designationId: string
                      employmentType: string
                      hasLinkedAccount: boolean
                      linkedAccountEmail?: string | null
                      linkedAccountRoles: string[]
                      joinDate: string
                      status: string
                      isActive: boolean
                      department: { name: string }
                      designation: { title: string }
                    }) => (
                      <AdminTableRow key={employee.id}>
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
                          <StatusBadge tone={employee.isActive ? 'success' : 'neutral'}>
                            {employee.status}
                          </StatusBadge>
                        </td>
                        {accountManagerAccess ? (
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => handleEditEmployee(employee)}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </Button>
                              {employee.isActive ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  disabled={deactivatingEmployee}
                                  onClick={() =>
                                    handleDeactivateEmployee(employee.id, employee.fullName)
                                  }
                                >
                                  <UserX className="mr-2 h-4 w-4" />
                                  Deactivate
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        ) : null}
                      </AdminTableRow>
                    )
                  )}
                </tbody>
            </AdminTable>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
