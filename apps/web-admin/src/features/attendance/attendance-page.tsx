import { FormEvent, useEffect, useState } from 'react'
import { AdminHero } from '@/components/admin/admin-hero'
import { PageFeedback } from '@/components/admin/page-feedback'
import { Button } from '@/components/ui/button'
import { Clock3, MapPin, Settings2 } from 'lucide-react'
import { MetricCard } from '@/components/ui/metric-card'
import {
  AttendanceActionCard,
  AttendanceRecordsCard,
  LocationListCard,
} from './components'
import { AttendanceSetupDrawer } from './forms'
import { useAttendanceWorkspaceGraphql } from './hooks'
import {
  assignmentFormDefaults,
  attendanceActionDefaults,
  locationFormDefaults,
} from './types'

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
        <AttendanceActionCard
          attendanceForm={attendanceForm}
          clockingIn={clockingIn}
          clockingOut={clockingOut}
          employees={employees}
          handleClockIn={handleClockIn}
          handleClockOut={handleClockOut}
          locations={locations}
          selectedAttendanceLocation={selectedAttendanceLocation}
          setAttendanceForm={setAttendanceForm}
        />

        <AttendanceRecordsCard
          attendanceFilterEmployeeId={attendanceFilterEmployeeId}
          attendanceRecords={attendanceRecords}
          employees={employees}
          error={error}
          loading={loading}
          setAttendanceFilterEmployeeId={setAttendanceFilterEmployeeId}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <LocationListCard
          deactivatingLocation={deactivatingLocation}
          handleDeactivateLocation={handleDeactivateLocation}
          handleEditLocation={handleEditLocation}
          locations={locations}
        />

        <AttendanceSetupDrawer
          activeAssignments={activeAssignments}
          assigningLocation={assigningLocation}
          assignmentForm={assignmentForm}
          creatingLocation={creatingLocation}
          editingLocationId={editingLocationId}
          employees={employees}
          handleAssignLocation={handleAssignLocation}
          handleCancelLocationEdit={handleCancelLocationEdit}
          handleSaveLocation={handleSaveLocation}
          locationForm={locationForm}
          locations={locations}
          open={showSetup}
          setAssignmentForm={setAssignmentForm}
          setLocationForm={setLocationForm}
          setShowSetup={setShowSetup}
          updatingLocation={updatingLocation}
        />
      </div>
    </div>
  )
}
