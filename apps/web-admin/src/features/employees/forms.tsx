import type { Dispatch, FormEventHandler, SetStateAction } from 'react'
import { Pencil, UserX } from 'lucide-react'

import { RecordCard } from '@/components/admin/record-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { StatusBadge } from '@/components/ui/status-badge'

import type { EmployeeListRow } from './components'
import type {
  DepartmentFormState,
  DesignationFormState,
  EmployeeAccountFormState,
  EmployeeFormState,
  StaffAccessFormState,
} from './types'

type DepartmentRow = {
  id: string
  name: string
  code: string
  description?: string | null
  isActive: boolean
}

type DesignationRow = {
  id: string
  title: string
  code: string
  departmentId: string
  level: number
  description?: string | null
  isActive: boolean
}

type EmployeesFormsDrawerProps = {
  accountManagerAccess: boolean
  activeDepartments: DepartmentRow[]
  activeDesignations: DesignationRow[]
  closeFormsDrawer: () => void
  creatingDepartment: boolean
  creatingDesignation: boolean
  creatingEmployee: boolean
  creatingEmployeeAccount: boolean
  deactivatingDepartment: boolean
  deactivatingDesignation: boolean
  departmentForm: DepartmentFormState
  departments: DepartmentRow[]
  designationForm: DesignationFormState
  designations: DesignationRow[]
  editingDepartmentId: string | null
  editingDesignationId: string | null
  editingEmployeeId: string | null
  employeeAccountForm: EmployeeAccountFormState
  employeeDesignationOptions: DesignationRow[]
  employeeForm: EmployeeFormState
  employees: EmployeeListRow[]
  handleCancelDepartmentEdit: () => void
  handleCancelDesignationEdit: () => void
  handleCancelEmployeeEdit: () => void
  handleCreateEmployeeAccount: FormEventHandler<HTMLFormElement>
  handleDeactivateDepartment: (departmentId: string, departmentName: string) => void
  handleDeactivateDesignation: (designationId: string, designationTitle: string) => void
  handleEditDepartment: (department: DepartmentRow) => void
  handleEditDesignation: (designation: DesignationRow) => void
  handleProvisionStaffAccess: FormEventHandler<HTMLFormElement>
  handleSaveDepartment: FormEventHandler<HTMLFormElement>
  handleSaveDesignation: FormEventHandler<HTMLFormElement>
  handleSaveEmployee: FormEventHandler<HTMLFormElement>
  open: boolean
  provisioningStaffAccess: boolean
  selectedEmployeeForAccount?: EmployeeListRow
  selectedEmployeeForStaffAccess?: EmployeeListRow
  selectedStaffEmployeeHasLinkedAccount: boolean
  setDepartmentForm: Dispatch<SetStateAction<DepartmentFormState>>
  setDesignationForm: Dispatch<SetStateAction<DesignationFormState>>
  setEmployeeAccountForm: Dispatch<SetStateAction<EmployeeAccountFormState>>
  setEmployeeForm: Dispatch<SetStateAction<EmployeeFormState>>
  setShowForms: Dispatch<SetStateAction<boolean>>
  setStaffAccessForm: Dispatch<SetStateAction<StaffAccessFormState>>
  staffAccessForm: StaffAccessFormState
  updatingDepartment: boolean
  updatingDesignation: boolean
  updatingEmployee: boolean
}

export function EmployeesFormsDrawer({
  accountManagerAccess,
  activeDepartments,
  activeDesignations,
  closeFormsDrawer,
  creatingDepartment,
  creatingDesignation,
  creatingEmployee,
  creatingEmployeeAccount,
  deactivatingDepartment,
  deactivatingDesignation,
  departmentForm,
  departments,
  designationForm,
  designations,
  editingDepartmentId,
  editingDesignationId,
  editingEmployeeId,
  employeeAccountForm,
  employeeDesignationOptions,
  employeeForm,
  employees,
  handleCancelDepartmentEdit,
  handleCancelDesignationEdit,
  handleCancelEmployeeEdit,
  handleCreateEmployeeAccount,
  handleDeactivateDepartment,
  handleDeactivateDesignation,
  handleEditDepartment,
  handleEditDesignation,
  handleProvisionStaffAccess,
  handleSaveDepartment,
  handleSaveDesignation,
  handleSaveEmployee,
  open,
  provisioningStaffAccess,
  selectedEmployeeForAccount,
  selectedEmployeeForStaffAccess,
  selectedStaffEmployeeHasLinkedAccount,
  setDepartmentForm,
  setDesignationForm,
  setEmployeeAccountForm,
  setEmployeeForm,
  setShowForms,
  setStaffAccessForm,
  staffAccessForm,
  updatingDepartment,
  updatingDesignation,
  updatingEmployee,
}: EmployeesFormsDrawerProps) {
  return (
    <FormDrawer
      open={open}
      onOpenChange={(drawerOpen) => {
        if (drawerOpen) {
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
              {departments.map((department) => (
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
              ))}
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
                    {activeDepartments.map((department) => (
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
              {designations.map((designation) => (
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
              ))}
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
                      {activeDepartments.map((department) => (
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
                      {employeeDesignationOptions.map((designation) => (
                        <SelectItem key={designation.id} value={designation.id}>
                          {designation.title}
                        </SelectItem>
                      ))}
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
                          .filter((employee) => !employee.hasLinkedAccount)
                          .map((employee) => (
                            <SelectItem key={employee.id} value={employee.id}>
                              {employee.fullName} ({employee.employeeNumber}) - {employee.email}
                            </SelectItem>
                          ))}
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
                        {employees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.fullName} ({employee.employeeNumber}) - {employee.email}
                            {employee.linkedAccountRoles.length > 0
                              ? ` - ${employee.linkedAccountRoles.join(', ')}`
                              : ''}
                          </SelectItem>
                        ))}
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
                  {(selectedEmployeeForStaffAccess?.linkedAccountRoles?.length ?? 0) > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Current roles: {selectedEmployeeForStaffAccess?.linkedAccountRoles.join(', ')}
                    </p>
                  )}
                </form>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </FormDrawer>
  )
}
