import { FormEvent, useDeferredValue, useState } from 'react'
import { PageFeedback } from '@/components/admin/page-feedback'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Search } from 'lucide-react'
import { canManageAccounts, readStoredAdminAccount } from '@/lib/auth-session'
import { EmployeeListCard } from './components'
import type { EmployeeListRow } from './components'
import { EmployeesFormsDrawer } from './forms'
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

  const handleEditEmployee = (employee: EmployeeListRow) => {
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

      <EmployeesFormsDrawer
        accountManagerAccess={accountManagerAccess}
        activeDepartments={activeDepartments}
        activeDesignations={activeDesignations}
        closeFormsDrawer={closeFormsDrawer}
        creatingDepartment={creatingDepartment}
        creatingDesignation={creatingDesignation}
        creatingEmployee={creatingEmployee}
        creatingEmployeeAccount={creatingEmployeeAccount}
        deactivatingDepartment={deactivatingDepartment}
        deactivatingDesignation={deactivatingDesignation}
        departmentForm={departmentForm}
        departments={departments}
        designationForm={designationForm}
        designations={designations}
        editingDepartmentId={editingDepartmentId}
        editingDesignationId={editingDesignationId}
        editingEmployeeId={editingEmployeeId}
        employeeAccountForm={employeeAccountForm}
        employeeDesignationOptions={employeeDesignationOptions}
        employeeForm={employeeForm}
        employees={employees}
        handleCancelDepartmentEdit={handleCancelDepartmentEdit}
        handleCancelDesignationEdit={handleCancelDesignationEdit}
        handleCancelEmployeeEdit={handleCancelEmployeeEdit}
        handleCreateEmployeeAccount={handleCreateEmployeeAccount}
        handleDeactivateDepartment={handleDeactivateDepartment}
        handleDeactivateDesignation={handleDeactivateDesignation}
        handleEditDepartment={handleEditDepartment}
        handleEditDesignation={handleEditDesignation}
        handleProvisionStaffAccess={handleProvisionStaffAccess}
        handleSaveDepartment={handleSaveDepartment}
        handleSaveDesignation={handleSaveDesignation}
        handleSaveEmployee={handleSaveEmployee}
        open={showForms}
        provisioningStaffAccess={provisioningStaffAccess}
        selectedEmployeeForAccount={selectedEmployeeForAccount}
        selectedEmployeeForStaffAccess={selectedEmployeeForStaffAccess}
        selectedStaffEmployeeHasLinkedAccount={selectedStaffEmployeeHasLinkedAccount}
        setDepartmentForm={setDepartmentForm}
        setDesignationForm={setDesignationForm}
        setEmployeeAccountForm={setEmployeeAccountForm}
        setEmployeeForm={setEmployeeForm}
        setShowForms={setShowForms}
        setStaffAccessForm={setStaffAccessForm}
        staffAccessForm={staffAccessForm}
        updatingDepartment={updatingDepartment}
        updatingDesignation={updatingDesignation}
        updatingEmployee={updatingEmployee}
      />

      <EmployeeListCard
        accountManagerAccess={accountManagerAccess}
        deactivatingEmployee={deactivatingEmployee}
        employees={employees}
        error={error}
        handleDeactivateEmployee={handleDeactivateEmployee}
        handleEditEmployee={handleEditEmployee}
        loading={loading}
      />
    </div>
  )
}
