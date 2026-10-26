export type AttendanceEmployee = {
  id: string
  employeeNumber: string
  fullName: string
  isActive: boolean
  department: { name: string }
}

export type AttendanceRecord = {
  id: string
  attendanceDate: string
  clockInAt?: string | null
  clockOutAt?: string | null
  totalHours?: number | null
  regularHours?: number | null
  overtimeHours?: number | null
  status: string
  employee: { id: string; employeeNumber: string; fullName: string }
  location: { id: string; code: string; name: string }
}

export type OpenRecord = {
  id: string
  attendanceDate: string
  clockInAt?: string | null
  status: string
  location: { id: string; name: string }
}
