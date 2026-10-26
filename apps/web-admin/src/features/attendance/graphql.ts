import { gql } from '@apollo/client'

export const ATTENDANCE_WORKSPACE_QUERY = gql`
  query AttendanceWorkspace($filter: AttendanceFilterInput) {
    employees {
      id
      employeeNumber
      fullName
      isActive
      department {
        name
      }
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

export const OPEN_ATTENDANCE_QUERY = gql`
  query OpenAttendance($filter: AttendanceFilterInput) {
    attendanceRecords(filter: $filter) {
      id
      attendanceDate
      clockInAt
      status
      location {
        id
        name
      }
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
