import { useMutation, useQuery } from '@apollo/client'

import {
  ASSIGN_EMPLOYEE_LOCATION_MUTATION,
  ATTENDANCE_WORKSPACE_QUERY,
  CLOCK_IN_MUTATION,
  CLOCK_OUT_MUTATION,
  CREATE_LOCATION_MUTATION,
  DEACTIVATE_LOCATION_MUTATION,
  EMPLOYEE_LOCATIONS_QUERY,
  UPDATE_LOCATION_MUTATION,
} from './graphql'

export function useAttendanceWorkspaceGraphql({
  assignmentEmployeeId,
  attendanceFilterEmployeeId,
}: {
  assignmentEmployeeId: string
  attendanceFilterEmployeeId: string
}) {
  const { data, loading, error, refetch } = useQuery(ATTENDANCE_WORKSPACE_QUERY, {
    variables: {
      filter: attendanceFilterEmployeeId
        ? {
            employeeId: attendanceFilterEmployeeId,
          }
        : null,
    },
  })

  const { data: assignmentsData, refetch: refetchAssignments } = useQuery(
    EMPLOYEE_LOCATIONS_QUERY,
    {
      variables: {
        employeeId: assignmentEmployeeId,
      },
      skip: !assignmentEmployeeId,
    }
  )

  const [createLocation, { loading: creatingLocation }] = useMutation(
    CREATE_LOCATION_MUTATION
  )
  const [updateLocation, { loading: updatingLocation }] = useMutation(
    UPDATE_LOCATION_MUTATION
  )
  const [deactivateLocation, { loading: deactivatingLocation }] = useMutation(
    DEACTIVATE_LOCATION_MUTATION
  )
  const [assignEmployeeLocation, { loading: assigningLocation }] = useMutation(
    ASSIGN_EMPLOYEE_LOCATION_MUTATION
  )
  const [clockIn, { loading: clockingIn }] = useMutation(CLOCK_IN_MUTATION)
  const [clockOut, { loading: clockingOut }] = useMutation(CLOCK_OUT_MUTATION)

  return {
    data,
    loading,
    error,
    refetch,
    assignmentsData,
    refetchAssignments,
    createLocation,
    creatingLocation,
    updateLocation,
    updatingLocation,
    deactivateLocation,
    deactivatingLocation,
    assignEmployeeLocation,
    assigningLocation,
    clockIn,
    clockingIn,
    clockOut,
    clockingOut,
  }
}
