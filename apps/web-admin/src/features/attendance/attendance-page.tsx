import { FormEvent, useEffect, useState } from 'react'
import { AdminHero } from '@/components/admin/admin-hero'
import { AdminTable, AdminTableEmpty, AdminTableRow } from '@/components/admin/admin-table'
import { PageFeedback } from '@/components/admin/page-feedback'
import { RecordCard } from '@/components/admin/record-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { Clock3, MapPin, Pencil, Settings2, XCircle } from 'lucide-react'
import { MetricCard } from '@/components/ui/metric-card'
import { Notice } from '@/components/ui/notice'
import { StatusBadge } from '@/components/ui/status-badge'
import { useAttendanceWorkspaceGraphql } from './hooks'
import {
  assignmentFormDefaults,
  attendanceActionDefaults,
  locationFormDefaults,
} from './types'

const ALL_EMPLOYEES_FILTER_VALUE = 'ALL_EMPLOYEES'

export function AttendancePage() {
  const [locationForm, setLocationForm] = useState(locationFormDefaults)
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null)
  const [assignmentForm, setAssignmentForm] = useState(assignmentFormDefaults)
  const [attendanceForm, setAttendanceForm] = useState(attendanceActionDefaults)
  const [attendanceFilterEmployeeId, setAttendanceFilterEmployeeId] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showSetup, setShowSetup] = useState(false)

  const {
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
  } = useAttendanceWorkspaceGraphql({
    assignmentEmployeeId: assignmentForm.employeeId,
    attendanceFilterEmployeeId,
  })

  const employees = data?.employees ?? []
  const locations = data?.locations ?? []
  const attendanceRecords = data?.attendanceRecords ?? []
  const activeAssignments = assignmentsData?.employeeLocations ?? []
  const activeLocationsCount = locations.filter(
    (location: { isActive: boolean }) => location.isActive
  ).length

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

  const handleSaveLocation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      const input = {
        name: locationForm.name,
        code: locationForm.code,
        address: locationForm.address,
        city: locationForm.city || null,
        latitude: Number.parseFloat(locationForm.latitude),
        longitude: Number.parseFloat(locationForm.longitude),
        geofenceRadius: Number.parseInt(locationForm.geofenceRadius || '100', 10),
      }

      if (editingLocationId) {
        await updateLocation({
          variables: {
            input: {
              id: editingLocationId,
              ...input,
            },
          },
        })
      } else {
        await createLocation({
          variables: {
            input,
          },
        })
      }
      setLocationForm(locationFormDefaults)
      setEditingLocationId(null)
      setStatusMessage(editingLocationId ? 'Location updated.' : 'Location created.')
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to save location.'
      )
    }
  }

  const handleEditLocation = (location: {
    id: string
    name: string
    code: string
    address: string
    city?: string | null
    latitude: number
    longitude: number
    geofenceRadius: number
  }) => {
    setShowSetup(true)
    setEditingLocationId(location.id)
    setLocationForm({
      name: location.name,
      code: location.code,
      address: location.address,
      city: location.city ?? '',
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      geofenceRadius: String(location.geofenceRadius),
    })
    setErrorMessage(null)
    setStatusMessage(null)
  }

  const handleCancelLocationEdit = () => {
    setEditingLocationId(null)
    setLocationForm(locationFormDefaults)
  }

  const handleDeactivateLocation = async (locationId: string, name: string) => {
    if (!window.confirm(`Deactivate ${name}? Attendance actions will stop using it.`)) {
      return
    }

    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await deactivateLocation({
        variables: {
          input: {
            id: locationId,
          },
        },
      })
      setStatusMessage('Location deactivated.')
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to deactivate location.'
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
    <div className="space-y-4">
      <AdminHero
        compact
        kicker="Attendance workspace"
        title="Keep daily attendance actions front and center."
        description="Record attendance fast, review current activity, and open setup only when location changes are needed."
        actions={
          <Button variant="outline" onClick={() => setShowSetup(true)}>
            <Settings2 className="mr-2 h-4 w-4" />
            Open setup
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          detail="Records in current view"
          icon={Clock3}
          label="Attendance records"
          tone="bg-sky-100 text-sky-800"
          value={String(attendanceRecords.length)}
        />
        <MetricCard
          detail="Locations currently usable"
          icon={MapPin}
          label="Active locations"
          tone="bg-emerald-100 text-emerald-800"
          value={String(activeLocationsCount)}
        />
        <MetricCard
          detail="Assignments for selected employee"
          icon={Settings2}
          label="Active assignments"
          tone="bg-amber-100 text-amber-800"
          value={String(activeAssignments.length)}
        />
      </div>

      <PageFeedback errorMessage={errorMessage} statusMessage={statusMessage} />

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <p className="app-kicker">Action</p>
            <CardTitle>Attendance Action</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="attendance-employee">Employee</Label>
              <Select
                name="attendance-employee"
                value={attendanceForm.employeeId}
                onValueChange={(employeeId) =>
                  setAttendanceForm((current) => ({
                    ...current,
                    employeeId,
                  }))
                }
              >
                <SelectTrigger id="attendance-employee">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(
                    (employee: {
                      id: string
                      fullName: string
                      employeeNumber: string
                    }) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.fullName} ({employee.employeeNumber})
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="attendance-location">Location</Label>
              <Select
                name="attendance-location"
                value={attendanceForm.locationId}
                onValueChange={(locationId) =>
                  setAttendanceForm((current) => ({
                    ...current,
                    locationId,
                  }))
                }
              >
                <SelectTrigger id="attendance-location">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations
                    .filter((location: { isActive: boolean }) => location.isActive)
                    .map((location: { id: string; name: string; code: string }) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name} ({location.code})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
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
            {selectedAttendanceLocation ? (
              <div className="app-muted-surface p-4 text-sm text-muted-foreground">
                Using {selectedAttendanceLocation.name} defaults with a{' '}
                {selectedAttendanceLocation.geofenceRadius}m geofence radius.
              </div>
            ) : null}
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

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="app-kicker">Live log</p>
                <CardTitle>Attendance Records</CardTitle>
              </div>
              <div className="min-w-[250px]">
                <Label htmlFor="attendance-filter-employee">Filter by Employee</Label>
                <Select
                  name="attendance-filter-employee"
                  value={attendanceFilterEmployeeId || ALL_EMPLOYEES_FILTER_VALUE}
                  onValueChange={(employeeId) =>
                    setAttendanceFilterEmployeeId(
                      employeeId === ALL_EMPLOYEES_FILTER_VALUE ? '' : employeeId
                    )
                  }
                >
                  <SelectTrigger id="attendance-filter-employee" className="mt-2">
                    <SelectValue placeholder="All employees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_EMPLOYEES_FILTER_VALUE}>
                      All employees
                    </SelectItem>
                    {employees.map(
                      (employee: {
                        id: string
                        fullName: string
                        employeeNumber: string
                      }) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.fullName} ({employee.employeeNumber})
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading attendance data...</p>
            ) : error ? (
              <Notice tone="danger">Unable to load attendance data. {error.message}</Notice>
            ) : attendanceRecords.length === 0 ? (
              <AdminTableEmpty>
                No attendance records yet. Use the action panel to create the first one.
              </AdminTableEmpty>
            ) : (
              <AdminTable>
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
                        <AdminTableRow key={record.id}>
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
                            <StatusBadge tone="info">{record.status}</StatusBadge>
                          </td>
                        </AdminTableRow>
                      )
                    )}
                  </tbody>
              </AdminTable>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <p className="app-kicker">Locations</p>
            <CardTitle>Location list</CardTitle>
          </CardHeader>
          <CardContent>
            {locations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No locations created yet.</p>
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
                    latitude: number
                    longitude: number
                  }) => (
                    <RecordCard key={location.id}>
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
                        <StatusBadge tone={location.isActive ? 'success' : 'neutral'}>
                          {location.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </StatusBadge>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        Geofence radius: {location.geofenceRadius}m
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleEditLocation(location)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        {location.isActive ? (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={deactivatingLocation}
                            onClick={() =>
                              handleDeactivateLocation(location.id, location.name)
                            }
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Deactivate
                          </Button>
                        ) : null}
                      </div>
                    </RecordCard>
                  )
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <FormDrawer
          open={showSetup}
          onOpenChange={(open) => {
            if (open) {
              setShowSetup(true)
            } else {
              setShowSetup(false)
              handleCancelLocationEdit()
            }
          }}
          kicker="Attendance setup"
          title="Locations and assignments"
          description="Create work locations and assign employees without leaving the attendance workspace."
          className="sm:w-[min(980px,calc(100vw-2rem))]"
        >
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <p className="app-kicker">Setup</p>
                <CardTitle>{editingLocationId ? 'Edit Location' : 'Create Location'}</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleSaveLocation}>
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
              <Button
                className="w-full"
                type="submit"
                disabled={creatingLocation || updatingLocation}
              >
                {creatingLocation || updatingLocation
                  ? 'Saving...'
                  : editingLocationId
                    ? 'Update Location'
                    : 'Create Location'}
              </Button>
              {editingLocationId ? (
                <Button
                  className="w-full"
                  type="button"
                  variant="outline"
                  onClick={handleCancelLocationEdit}
                >
                  Cancel Edit
                </Button>
              ) : null}
            </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <p className="app-kicker">Setup</p>
                <CardTitle>Assign Employee</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleAssignLocation}>
              <div className="space-y-2">
                <Label htmlFor="assignment-employee">Employee</Label>
                <Select
                  name="assignment-employee"
                  value={assignmentForm.employeeId}
                  onValueChange={(employeeId) =>
                    setAssignmentForm((current) => ({
                      ...current,
                      employeeId,
                    }))
                  }
                  required
                >
                  <SelectTrigger id="assignment-employee">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(
                      (employee: {
                        id: string
                        fullName: string
                        employeeNumber: string
                      }) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.fullName} ({employee.employeeNumber})
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignment-location">Location</Label>
                <Select
                  name="assignment-location"
                  value={assignmentForm.locationId}
                  onValueChange={(locationId) =>
                    setAssignmentForm((current) => ({
                      ...current,
                      locationId,
                    }))
                  }
                  required
                >
                  <SelectTrigger id="assignment-location">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location: { id: string; name: string; code: string }) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name} ({location.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignment-primary">Assignment Type</Label>
                <Select
                  name="assignment-primary"
                  value={assignmentForm.isPrimary}
                  onValueChange={(isPrimary) =>
                    setAssignmentForm((current) => ({
                      ...current,
                      isPrimary,
                    }))
                  }
                >
                  <SelectTrigger id="assignment-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Primary</SelectItem>
                    <SelectItem value="false">Secondary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                type="submit"
                disabled={assigningLocation || employees.length === 0 || locations.length === 0}
              >
                {assigningLocation ? 'Saving...' : 'Assign Location'}
              </Button>
            </form>

              {assignmentForm.employeeId && activeAssignments.length > 0 ? (
                <div className="mt-6 space-y-3">
                  <h3 className="text-sm font-semibold">Active Assignments</h3>
                  {activeAssignments.map(
                    (assignment: {
                      id: string
                      isPrimary: boolean
                      assignedDate: string
                      location: { name: string; code: string; geofenceRadius: number }
                    }) => (
                      <RecordCard key={assignment.id} className="p-3 text-sm">
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
                      </RecordCard>
                    )
                  )}
                </div>
              ) : null}
              </CardContent>
            </Card>
          </div>
        </FormDrawer>
      </div>
    </div>
  )
}
