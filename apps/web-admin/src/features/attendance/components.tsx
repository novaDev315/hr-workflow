import { Dispatch, SetStateAction } from 'react'

import { AdminTable, AdminTableEmpty, AdminTableRow } from '@/components/admin/admin-table'
import { RecordCard } from '@/components/admin/record-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Notice } from '@/components/ui/notice'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Pencil, XCircle } from 'lucide-react'

import type { AttendanceActionFormState } from './types'

const ALL_EMPLOYEES_FILTER_VALUE = 'ALL_EMPLOYEES'

type EmployeeOption = {
  id: string
  fullName: string
  employeeNumber: string
}

type LocationOption = {
  id: string
  name: string
  code: string
  city?: string | null
  address: string
  geofenceRadius: number
  isActive: boolean
  latitude: number
  longitude: number
}

type AttendanceRecordRow = {
  id: string
  attendanceDate: string
  clockInAt?: string | null
  clockOutAt?: string | null
  totalHours?: number | null
  status: string
  employee: { fullName: string; employeeNumber: string }
  location: { name: string; code: string }
}

export function AttendanceActionCard({
  attendanceForm,
  clockingIn,
  clockingOut,
  employees,
  handleClockIn,
  handleClockOut,
  locations,
  selectedAttendanceLocation,
  setAttendanceForm,
}: {
  attendanceForm: AttendanceActionFormState
  clockingIn: boolean
  clockingOut: boolean
  employees: EmployeeOption[]
  handleClockIn: () => void
  handleClockOut: () => void
  locations: LocationOption[]
  selectedAttendanceLocation: LocationOption | null
  setAttendanceForm: Dispatch<SetStateAction<AttendanceActionFormState>>
}) {
  return (
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
              {employees.map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.fullName} ({employee.employeeNumber})
                </SelectItem>
              ))}
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
                .filter((location) => location.isActive)
                .map((location) => (
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
  )
}

export function AttendanceRecordsCard({
  attendanceFilterEmployeeId,
  attendanceRecords,
  employees,
  error,
  loading,
  setAttendanceFilterEmployeeId,
}: {
  attendanceFilterEmployeeId: string
  attendanceRecords: AttendanceRecordRow[]
  employees: EmployeeOption[]
  error?: { message: string }
  loading: boolean
  setAttendanceFilterEmployeeId: (employeeId: string) => void
}) {
  return (
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
                <SelectItem value={ALL_EMPLOYEES_FILTER_VALUE}>All employees</SelectItem>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.fullName} ({employee.employeeNumber})
                  </SelectItem>
                ))}
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
              {attendanceRecords.map((record) => (
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
                      : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {record.clockOutAt
                      ? new Date(record.clockOutAt).toLocaleTimeString()
                      : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {record.totalHours != null ? `${record.totalHours}h` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone="info">{record.status}</StatusBadge>
                  </td>
                </AdminTableRow>
              ))}
            </tbody>
          </AdminTable>
        )}
      </CardContent>
    </Card>
  )
}

export function LocationListCard({
  deactivatingLocation,
  handleDeactivateLocation,
  handleEditLocation,
  locations,
}: {
  deactivatingLocation: boolean
  handleDeactivateLocation: (locationId: string, locationName: string) => void
  handleEditLocation: (location: LocationOption) => void
  locations: LocationOption[]
}) {
  return (
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
            {locations.map((location) => (
              <RecordCard key={location.id}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {location.name} ({location.code})
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {location.city ? `${location.city} - ` : ''}
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
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
