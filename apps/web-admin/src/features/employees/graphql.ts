import { gql } from '@apollo/client'

export const PEOPLE_QUERY = gql`
  query PeopleDirectory {
    employees {
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
      supervisorName
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

export const EMPLOYEE_COMPENSATIONS_QUERY = gql`
  query EmployeeCompensations {
    employeeCompensations {
      id
      employeeId
      baseSalary
      allowanceAmount
      deductionAmount
      currencyCode
      effectiveFrom
    }
  }
`

export const CREATE_EMPLOYEE_MUTATION = gql`
  mutation CreateEmployee($input: CreateEmployeeInput!) {
    createEmployee(input: $input) {
      id
      fullName
      employeeNumber
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

export const UPSERT_COMPENSATION_MUTATION = gql`
  mutation UpsertEmployeeCompensation($input: UpsertEmployeeCompensationInput!) {
    upsertEmployeeCompensation(input: $input) {
      id
    }
  }
`

export const ASSIGN_SITE_MUTATION = gql`
  mutation AssignEmployeeLocation($input: AssignEmployeeLocationInput!) {
    assignEmployeeLocation(input: $input) {
      id
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

export const PEOPLE_REFETCH = ['PeopleDirectory', 'OrganisationPeople', 'AttendanceWorkspace']
