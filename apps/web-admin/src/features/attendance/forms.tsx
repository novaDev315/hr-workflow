import type { Dispatch, FormEventHandler, SetStateAction } from 'react'

import { RecordCard } from '@/components/admin/record-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

import type { AssignmentFormState, LocationFormState } from './types'

type AttendanceEmployeeOption = {
  id: string
  fullName: string
  employeeNumber: string
}

type AttendanceLocationOption = {
  id: string
  name: string
  code: string
}

type AssignmentRow = {
  id: string
  isPrimary: boolean
  assignedDate: string
  location: { name: string; code: string; geofenceRadius: number }
}

export function AttendanceSetupDrawer({
  activeAssignments,
  assigningLocation,
  assignmentForm,
  creatingLocation,
  editingLocationId,
  employees,
  handleAssignLocation,
  handleCancelLocationEdit,
  handleSaveLocation,
  locationForm,
  locations,
  open,
  setAssignmentForm,
  setLocationForm,
  setShowSetup,
  updatingLocation,
}: {
  activeAssignments: AssignmentRow[]
  assigningLocation: boolean
  assignmentForm: AssignmentFormState
  creatingLocation: boolean
  editingLocationId: string | null
  employees: AttendanceEmployeeOption[]
  handleAssignLocation: FormEventHandler<HTMLFormElement>
  handleCancelLocationEdit: () => void
  handleSaveLocation: FormEventHandler<HTMLFormElement>
  locationForm: LocationFormState
  locations: AttendanceLocationOption[]
  open: boolean
  setAssignmentForm: Dispatch<SetStateAction<AssignmentFormState>>
  setLocationForm: Dispatch<SetStateAction<LocationFormState>>
  setShowSetup: Dispatch<SetStateAction<boolean>>
  updatingLocation: boolean
}) {
  return (
    <FormDrawer
      open={open}
      onOpenChange={(drawerOpen) => {
        if (drawerOpen) {
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
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.fullName} ({employee.employeeNumber})
                      </SelectItem>
                    ))}
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
                    {locations.map((location) => (
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
                {activeAssignments.map((assignment) => (
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
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </FormDrawer>
  )
}
