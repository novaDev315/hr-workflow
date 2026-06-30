import { gql } from '@apollo/client'

export const ATTENDANCE_WORKSPACE_QUERY = gql`
  query AttendanceWorkspace($filter: AttendanceFilterInput) {
    employees {
      id
      employeeNumber
      fullName
      department {
        name
      }
    }
    locations(activeOnly: false) {
      id
      code
      name
      latitude
      longitude
      geofenceRadius
      address
      city
      isActive
    }
    attendanceRecords(filter: $filter) {
      id
      attendanceDate
      clockInAt
      clockOutAt
      totalHours
      regularHours
      overtimeHours
      status
      employee {
        id
        employeeNumber
        fullName
      }
      location {
        id
        code
        name
      }
    }
  }
`

export const EMPLOYEE_LOCATIONS_QUERY = gql`
  query EmployeeLocations($employeeId: ID!) {
    employeeLocations(employeeId: $employeeId) {
      id
      isPrimary
      status
      assignedDate
      location {
        id
        code
        name
        geofenceRadius
      }
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

export const ASSIGN_EMPLOYEE_LOCATION_MUTATION = gql`
  mutation AssignEmployeeLocation($input: AssignEmployeeLocationInput!) {
    assignEmployeeLocation(input: $input) {
      id
    }
  }
`

export const CLOCK_IN_MUTATION = gql`
  mutation ClockIn($input: ClockInInput!) {
    clockIn(input: $input) {
      id
    }
  }
`

export const CLOCK_OUT_MUTATION = gql`
  mutation ClockOut($input: ClockOutInput!) {
    clockOut(input: $input) {
      id
    }
  }
`
