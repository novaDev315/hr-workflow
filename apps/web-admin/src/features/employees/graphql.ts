import { gql } from '@apollo/client'

export const EMPLOYEE_PAGE_QUERY = gql`
  query EmployeePageData($filter: EmployeeFilterInput) {
    departments(includeInactive: true) {
      id
      name
      code
      description
      isActive
    }
    designations(includeInactive: true) {
      id
      title
      code
      departmentId
      level
      description
      isActive
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
      exitDate
      status
      isActive
      supervisorId
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

export const CREATE_DEPARTMENT_MUTATION = gql`
  mutation CreateDepartment($input: CreateDepartmentInput!) {
    createDepartment(input: $input) {
      id
    }
  }
`

export const UPDATE_DEPARTMENT_MUTATION = gql`
  mutation UpdateDepartment($input: UpdateDepartmentInput!) {
    updateDepartment(input: $input) {
      id
    }
  }
`

export const DEACTIVATE_DEPARTMENT_MUTATION = gql`
  mutation DeactivateDepartment($input: DeactivateDepartmentInput!) {
    deactivateDepartment(input: $input) {
      id
      isActive
    }
  }
`

export const CREATE_DESIGNATION_MUTATION = gql`
  mutation CreateDesignation($input: CreateDesignationInput!) {
    createDesignation(input: $input) {
      id
    }
  }
`

export const UPDATE_DESIGNATION_MUTATION = gql`
  mutation UpdateDesignation($input: UpdateDesignationInput!) {
    updateDesignation(input: $input) {
      id
    }
  }
`

export const DEACTIVATE_DESIGNATION_MUTATION = gql`
  mutation DeactivateDesignation($input: DeactivateDesignationInput!) {
    deactivateDesignation(input: $input) {
      id
      isActive
    }
  }
`

export const CREATE_EMPLOYEE_MUTATION = gql`
  mutation CreateEmployee($input: CreateEmployeeInput!) {
    createEmployee(input: $input) {
      id
    }
  }
`

export const UPDATE_EMPLOYEE_MUTATION = gql`
  mutation UpdateEmployee($input: UpdateEmployeeInput!) {
    updateEmployee(input: $input) {
      id
    }
  }
`

export const DEACTIVATE_EMPLOYEE_MUTATION = gql`
  mutation DeactivateEmployee($input: DeactivateEmployeeInput!) {
    deactivateEmployee(input: $input) {
      id
      status
      isActive
    }
  }
`

export const CREATE_EMPLOYEE_ACCOUNT_MUTATION = gql`
  mutation CreateEmployeeAccount($input: CreateEmployeeAccountInput!) {
    createEmployeeAccount(input: $input) {
      account {
        id
      }
    }
  }
`

export const PROVISION_STAFF_ACCESS_MUTATION = gql`
  mutation ProvisionStaffAccess($input: ProvisionStaffAccessInput!) {
    provisionStaffAccess(input: $input) {
      id
      roles
    }
  }
`
