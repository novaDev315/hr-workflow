import { FormEvent, useEffect, useState } from 'react'
import { gql, useMutation, useQuery } from '@apollo/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const ATTENDANCE_WORKSPACE_QUERY = gql`
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

const EMPLOYEE_LOCATIONS_QUERY = gql`
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

const CREATE_LOCATION_MUTATION = gql`
  mutation CreateLocation($input: CreateLocationInput!) {
    createLocation(input: $input) {
      id
    }
  }
`

const ASSIGN_EMPLOYEE_LOCATION_MUTATION = gql`
  mutation AssignEmployeeLocation($input: AssignEmployeeLocationInput!) {
    assignEmployeeLocation(input: $input) {
      id
    }
  }
`

const CLOCK_IN_MUTATION = gql`
  mutation ClockIn($input: ClockInInput!) {
    clockIn(input: $input) {
      id
    }
  }
`

const CLOCK_OUT_MUTATION = gql`
  mutation ClockOut($input: ClockOutInput!) {
    clockOut(input: $input) {
      id
    }
  }
`

type LocationFormState = {
  name: string
  code: string
  address: string
  city: string
  latitude: string
  longitude: string
  geofenceRadius: string
}

type AssignmentFormState = {
  employeeId: string
  locationId: string
  isPrimary: string
}

type AttendanceActionFormState = {
  employeeId: string
  locationId: string
  latitude: string
  longitude: string
  notes: string
}

const locationFormDefaults: LocationFormState = {
  name: '',
  code: '',
  address: '',
  city: '',
  latitude: '',
  longitude: '',
  geofenceRadius: '100',
}

const assignmentFormDefaults: AssignmentFormState = {
  employeeId: '',
  locationId: '',
  isPrimary: 'true',
}

const attendanceActionDefaults: AttendanceActionFormState = {
  employeeId: '',
  locationId: '',
  latitude: '',
  longitude: '',
  notes: '',
}

export function AttendancePage() {
  const [locationForm, setLocationForm] = useState(locationFormDefaults)
  const [assignmentForm, setAssignmentForm] = useState(assignmentFormDefaults)
  const [attendanceForm, setAttendanceForm] = useState(attendanceActionDefaults)
  const [attendanceFilterEmployeeId, setAttendanceFilterEmployeeId] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery(ATTENDANCE_WORKSPACE_QUERY, {
    variables: {
      filter: attendanceFilterEmployeeId
        ? {
            employeeId: attendanceFilterEmployeeId,
          }
        : null,
    },
  })

  const {
    data: assignmentsData,
    refetch: refetchAssignments,
  } = useQuery(EMPLOYEE_LOCATIONS_QUERY, {
    variables: {
      employeeId: assignmentForm.employeeId,
    },
    skip: !assignmentForm.employeeId,
  })

  const [createLocation, { loading: creatingLocation }] = useMutation(
    CREATE_LOCATION_MUTATION
  )
  const [assignEmployeeLocation, { loading: assigningLocation }] = useMutation(
    ASSIGN_EMPLOYEE_LOCATION_MUTATION
  )
  const [clockIn, { loading: clockingIn }] = useMutation(CLOCK_IN_MUTATION)
  const [clockOut, { loading: clockingOut }] = useMutation(CLOCK_OUT_MUTATION)

  const employees = data?.employees ?? []
  const locations = data?.locations ?? []
  const attendanceRecords = data?.attendanceRecords ?? []
  const activeAssignments = assignmentsData?.employeeLocations ?? []

  const selectedAttendanceLocation = attendanceForm.locationId
    ? locations.find((location: { id: string }) => location.id === attendanceForm.locationId)
    : null

  useEffect(() => {
    if (!selectedAttendanceLocation) {
      return
    }

    setAttendanceForm((current) => ({
      ...current,
      latitude: String(selectedAttendanceLocation.latitude),
      longitude: String(selectedAttendanceLocation.longitude),
    }))
  }, [selectedAttendanceLocation])

  const handleCreateLocation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await createLocation({
        variables: {
          input: {
            name: locationForm.name,
            code: locationForm.code,
            address: locationForm.address,
            city: locationForm.city || null,
            latitude: Number.parseFloat(locationForm.latitude),
            longitude: Number.parseFloat(locationForm.longitude),
            geofenceRadius: Number.parseInt(locationForm.geofenceRadius || '100', 10),
          },
        },
      })
      setLocationForm(locationFormDefaults)
      setStatusMessage('Location created.')
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to create location.'
      )
    }
  }

  const handleAssignLocation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await assignEmployeeLocation({
        variables: {
          input: {
            employeeId: assignmentForm.employeeId,
            locationId: assignmentForm.locationId,
            isPrimary: assignmentForm.isPrimary === 'true',
          },
        },
      })
      setStatusMessage('Location assignment saved.')
      await refetch()
      await refetchAssignments()
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to assign location.'
      )
    }
  }

  const handleClockIn = async () => {
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await clockIn({
        variables: {
          input: {
            employeeId: attendanceForm.employeeId,
            locationId: attendanceForm.locationId,
            latitude: Number.parseFloat(attendanceForm.latitude),
            longitude: Number.parseFloat(attendanceForm.longitude),
            notes: attendanceForm.notes || null,
          },
        },
      })
      setStatusMessage('Clock in recorded.')
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to clock in.'
      )
    }
  }

  const handleClockOut = async () => {
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await clockOut({
        variables: {
          input: {
            employeeId: attendanceForm.employeeId,
            latitude: Number.parseFloat(attendanceForm.latitude),
            longitude: Number.parseFloat(attendanceForm.longitude),
            notes: attendanceForm.notes || null,
          },
        },
      })
      setStatusMessage('Clock out recorded.')
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to clock out.'
      )
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Attendance Management</h1>
        <p className="text-muted-foreground">
          Manage locations, assignments, and live attendance records from one workspace.
        </p>
      </div>

      {errorMessage && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">{errorMessage}</CardContent>
        </Card>
      )}

      {statusMessage && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4 text-sm text-emerald-700">
            {statusMessage}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Create Location</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCreateLocation}>
              <div className="space-y-2">
                <Label htmlFor="location-name">Location Name</Label>
                <Input
                  id="location-name"
                  value={locationForm.name}
                  onChange={(event) =>
                    setLocationForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location-code">Location Code</Label>
                <Input
                  id="location-code"
                  value={locationForm.code}
                  onChange={(event) =>
                    setLocationForm((current) => ({
                      ...current,
                      code: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="HQ_DXB"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location-address">Address</Label>
                <Input
                  id="location-address"
                  value={locationForm.address}
                  onChange={(event) =>
                    setLocationForm((current) => ({
                      ...current,
                      address: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location-city">City</Label>
                <Input
                  id="location-city"
                  value={locationForm.city}
                  onChange={(event) =>
                    setLocationForm((current) => ({
                      ...current,
                      city: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="location-latitude">Latitude</Label>
                  <Input
                    id="location-latitude"
                    type="number"
                    step="any"
                    value={locationForm.latitude}
                    onChange={(event) =>
                      setLocationForm((current) => ({
                        ...current,
                        latitude: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location-longitude">Longitude</Label>
                  <Input
                    id="location-longitude"
                    type="number"
                    step="any"
                    value={locationForm.longitude}
                    onChange={(event) =>
                      setLocationForm((current) => ({
                        ...current,
                        longitude: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="geofence-radius">Geofence Radius (m)</Label>
                <Input
                  id="geofence-radius"
                  type="number"
                  min="20"
                  value={locationForm.geofenceRadius}
                  onChange={(event) =>
                    setLocationForm((current) => ({
                      ...current,
                      geofenceRadius: event.target.value,
                    }))
                  }
                />
              </div>
              <Button className="w-full" type="submit" disabled={creatingLocation}>
                {creatingLocation ? 'Saving...' : 'Create Location'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assign Employee</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleAssignLocation}>
              <div className="space-y-2">
                <Label htmlFor="assignment-employee">Employee</Label>
                <select
                  id="assignment-employee"
                  value={assignmentForm.employeeId}
                  onChange={(event) =>
                    setAssignmentForm((current) => ({
                      ...current,
                      employeeId: event.target.value,
                    }))
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select employee</option>
                  {employees.map(
                    (employee: {
                      id: string
                      fullName: string
                      employeeNumber: string
                    }) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.fullName} ({employee.employeeNumber})
                      </option>
                    )
                  )}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignment-location">Location</Label>
                <select
                  id="assignment-location"
                  value={assignmentForm.locationId}
                  onChange={(event) =>
                    setAssignmentForm((current) => ({
                      ...current,
                      locationId: event.target.value,
                    }))
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select location</option>
                  {locations.map((location: { id: string; name: string; code: string }) => (
                    <option key={location.id} value={location.id}>
                      {location.name} ({location.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignment-primary">Assignment Type</Label>
                <select
                  id="assignment-primary"
                  value={assignmentForm.isPrimary}
                  onChange={(event) =>
                    setAssignmentForm((current) => ({
                      ...current,
                      isPrimary: event.target.value,
                    }))
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="true">Primary</option>
                  <option value="false">Secondary</option>
                </select>
              </div>
              <Button
                className="w-full"
                type="submit"
                disabled={assigningLocation || employees.length === 0 || locations.length === 0}
              >
                {assigningLocation ? 'Saving...' : 'Assign Location'}
              </Button>
            </form>

            {assignmentForm.employeeId && activeAssignments.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-semibold">Active Assignments</h3>
                {activeAssignments.map(
                  (assignment: {
                    id: string
                    isPrimary: boolean
                    assignedDate: string
                    location: { name: string; code: string; geofenceRadius: number }
                  }) => (
                    <div
                      key={assignment.id}
                      className="rounded-lg border border-border bg-muted/40 p-3 text-sm"
                    >
                      <div className="font-medium">
                        {assignment.location.name} ({assignment.location.code})
                      </div>
                      <div className="text-muted-foreground">
                        {assignment.isPrimary ? 'Primary' : 'Secondary'} assignment
                      </div>
                      <div className="text-muted-foreground">
                        Radius: {assignment.location.geofenceRadius}m
                      </div>
                      <div className="text-muted-foreground">
                        Assigned: {assignment.assignedDate}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendance Action</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="attendance-employee">Employee</Label>
              <select
                id="attendance-employee"
                value={attendanceForm.employeeId}
                onChange={(event) =>
                  setAttendanceForm((current) => ({
                    ...current,
                    employeeId: event.target.value,
                  }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select employee</option>
                {employees.map(
                  (employee: {
                    id: string
                    fullName: string
                    employeeNumber: string
                  }) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.fullName} ({employee.employeeNumber})
                    </option>
                  )
                )}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="attendance-location">Location</Label>
              <select
                id="attendance-location"
                value={attendanceForm.locationId}
                onChange={(event) =>
                  setAttendanceForm((current) => ({
                    ...current,
                    locationId: event.target.value,
                  }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select location</option>
                {locations
                  .filter((location: { isActive: boolean }) => location.isActive)
                  .map((location: { id: string; name: string; code: string }) => (
                    <option key={location.id} value={location.id}>
                      {location.name} ({location.code})
                    </option>
                  ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="attendance-latitude">Latitude</Label>
                <Input
                  id="attendance-latitude"
                  type="number"
                  step="any"
                  value={attendanceForm.latitude}
                  onChange={(event) =>
                    setAttendanceForm((current) => ({
                      ...current,
                      latitude: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="attendance-longitude">Longitude</Label>
                <Input
                  id="attendance-longitude"
                  type="number"
                  step="any"
                  value={attendanceForm.longitude}
                  onChange={(event) =>
                    setAttendanceForm((current) => ({
                      ...current,
                      longitude: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            {selectedAttendanceLocation && (
              <p className="text-xs text-muted-foreground">
                Using {selectedAttendanceLocation.name} coordinates and a{' '}
                {selectedAttendanceLocation.geofenceRadius}m geofence by default.
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="attendance-notes">Notes</Label>
              <Input
                id="attendance-notes"
                value={attendanceForm.notes}
                onChange={(event) =>
                  setAttendanceForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                placeholder="Optional note for this action"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                onClick={handleClockIn}
                disabled={
                  clockingIn ||
                  !attendanceForm.employeeId ||
                  !attendanceForm.locationId ||
                  !attendanceForm.latitude ||
                  !attendanceForm.longitude
                }
              >
                {clockingIn ? 'Clocking In...' : 'Clock In'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleClockOut}
                disabled={
                  clockingOut ||
                  !attendanceForm.employeeId ||
                  !attendanceForm.latitude ||
                  !attendanceForm.longitude
                }
              >
                {clockingOut ? 'Clocking Out...' : 'Clock Out'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Attendance Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-w-[260px]">
                <Label htmlFor="attendance-filter-employee">Filter by Employee</Label>
                <select
                  id="attendance-filter-employee"
                  value={attendanceFilterEmployeeId}
                  onChange={(event) => setAttendanceFilterEmployeeId(event.target.value)}
                  className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">All employees</option>
                  {employees.map(
                    (employee: {
                      id: string
                      fullName: string
                      employeeNumber: string
                    }) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.fullName} ({employee.employeeNumber})
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading attendance data...</p>
            ) : error ? (
              <p className="text-sm text-red-600">
                Unable to load attendance data. {error.message}
              </p>
            ) : attendanceRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No attendance records yet. Use the action card to create the first one.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Employee</th>
                      <th className="px-4 py-3 text-left">Location</th>
                      <th className="px-4 py-3 text-left">Clock In</th>
                      <th className="px-4 py-3 text-left">Clock Out</th>
                      <th className="px-4 py-3 text-left">Hours</th>
                      <th className="px-4 py-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRecords.map(
                      (record: {
                        id: string
                        attendanceDate: string
                        clockInAt?: string | null
                        clockOutAt?: string | null
                        totalHours?: number | null
                        status: string
                        employee: { fullName: string; employeeNumber: string }
                        location: { name: string; code: string }
                      }) => (
                        <tr key={record.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3">{record.attendanceDate}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{record.employee.fullName}</div>
                            <div className="text-xs text-muted-foreground">
                              {record.employee.employeeNumber}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {record.location.name} ({record.location.code})
                          </td>
                          <td className="px-4 py-3">
                            {record.clockInAt
                              ? new Date(record.clockInAt).toLocaleTimeString()
                              : '—'}
                          </td>
                          <td className="px-4 py-3">
                            {record.clockOutAt
                              ? new Date(record.clockOutAt).toLocaleTimeString()
                              : '—'}
                          </td>
                          <td className="px-4 py-3">
                            {record.totalHours != null ? `${record.totalHours}h` : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                              {record.status}
                            </span>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Locations</CardTitle>
          </CardHeader>
          <CardContent>
            {locations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No locations created yet.
              </p>
            ) : (
              <div className="space-y-3">
                {locations.map(
                  (location: {
                    id: string
                    name: string
                    code: string
                    city?: string | null
                    address: string
                    geofenceRadius: number
                    isActive: boolean
                  }) => (
                    <div
                      key={location.id}
                      className="rounded-lg border border-border bg-muted/40 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">
                            {location.name} ({location.code})
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {location.city ? `${location.city} • ` : ''}
                            {location.address}
                          </div>
                        </div>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            location.isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {location.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        Geofence radius: {location.geofenceRadius}m
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
