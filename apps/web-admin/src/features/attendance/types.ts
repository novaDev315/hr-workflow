export type LocationFormState = {
  name: string
  code: string
  address: string
  city: string
  latitude: string
  longitude: string
  geofenceRadius: string
}

export type AssignmentFormState = {
  employeeId: string
  locationId: string
  isPrimary: string
}

export type AttendanceActionFormState = {
  employeeId: string
  locationId: string
  latitude: string
  longitude: string
  notes: string
}

export const locationFormDefaults: LocationFormState = {
  name: '',
  code: '',
  address: '',
  city: '',
  latitude: '',
  longitude: '',
  geofenceRadius: '100',
}

export const assignmentFormDefaults: AssignmentFormState = {
  employeeId: '',
  locationId: '',
  isPrimary: 'true',
}

export const attendanceActionDefaults: AttendanceActionFormState = {
  employeeId: '',
  locationId: '',
  latitude: '',
  longitude: '',
  notes: '',
}
