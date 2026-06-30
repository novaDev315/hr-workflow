export type DepartmentFormState = {
  name: string
  code: string
  description: string
}

export type DesignationFormState = {
  title: string
  code: string
  departmentId: string
  level: string
  description: string
}

export type EmployeeFormState = {
  firstName: string
  lastName: string
  email: string
  phone: string
  departmentId: string
  designationId: string
  employmentType: string
  joinDate: string
  status: string
}

export type EmployeeAccountFormState = {
  employeeId: string
  password: string
}

export type StaffAccessFormState = {
  employeeId: string
  roleKey: string
  password: string
}

export const departmentFormDefaults: DepartmentFormState = {
  name: '',
  code: '',
  description: '',
}

export const designationFormDefaults: DesignationFormState = {
  title: '',
  code: '',
  departmentId: '',
  level: '1',
  description: '',
}

export const employeeFormDefaults: EmployeeFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  departmentId: '',
  designationId: '',
  employmentType: 'FULL_TIME',
  joinDate: new Date().toISOString().slice(0, 10),
  status: 'ACTIVE',
}

export const employeeAccountFormDefaults: EmployeeAccountFormState = {
  employeeId: '',
  password: '',
}

export const staffAccessFormDefaults: StaffAccessFormState = {
  employeeId: '',
  roleKey: 'MANAGER',
  password: '',
}
