import { gql } from '@apollo/client'

export const ORGANISATION_PEOPLE_QUERY = gql`
  query OrganisationPeople {
    employees {
      id
      departmentId
      designationId
      isActive
    }
  }
`

export const UPSERT_COMPANY_SETTINGS_MUTATION = gql`
  mutation UpsertCompanySettings($input: UpsertCompanySettingsInput!) {
    upsertCompanySettings(input: $input) {
      id
      companyName
      legalName
      countryCode
      currencyCode
      timezone
      supportEmail
      supportPhone
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

export const CREATE_LOCATION_MUTATION = gql`
  mutation CreateLocation($input: CreateLocationInput!) {
    createLocation(input: $input) {
      id
    }
  }
`

export const UPDATE_LOCATION_MUTATION = gql`
  mutation UpdateLocation($input: UpdateLocationInput!) {
    updateLocation(input: $input) {
      id
    }
  }
`

export const DEACTIVATE_LOCATION_MUTATION = gql`
  mutation DeactivateLocation($input: DeactivateLocationInput!) {
    deactivateLocation(input: $input) {
      id
      isActive
    }
  }
`

// Refetch these after any organisation change so every page sees it.
export const ORGANISATION_REFETCH = ['ReferenceData', 'OrganisationPeople', 'PeopleDirectory']
