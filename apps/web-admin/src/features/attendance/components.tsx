import { useMutation, useQuery } from '@apollo/client'
import { ChevronRight, LogIn, LogOut } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Notice } from '@/components/ui/notice'
import { StatusBadge } from '@/components/ui/status-badge'
import { SelectField, TextField } from '@/features/shared/controls'
import { DataTable, EmptyState, Td, Th, Tr } from '@/features/shared/data-table'
import { readableError } from '@/lib/graphql-errors'
import { SectionHeading } from '@/features/shared/page-intro'
import type { SiteAssignment, WorkSite } from '@/features/shared/reference-data'
import { formatDay, formatNumber, formatStatus, formatTime } from '@/lib/format'

import { CLOCK_IN_MUTATION, CLOCK_OUT_MUTATION, OPEN_ATTENDANCE_QUERY } from './graphql'
import type { AttendanceEmployee, AttendanceRecord, OpenRecord } from './types'

export function RecordAttendanceCard({
  employees,
  assignmentsFor,
  assignmentsLoading,
  sites,
  onRecorded,
}: {
  employees: AttendanceEmployee[]
  assignmentsFor: (employeeId: string) => SiteAssignment[] | undefined
  assignmentsLoading: boolean
  sites: WorkSite[]
  onRecorded: () => void
}) {
  const [employeeId, setEmployeeId] = useState('')
  const [siteId, setSiteId] = useState('')
  const [manual, setManual] = useState(false)
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [clockIn, clockInState] = useMutation(CLOCK_IN_MUTATION)
  const [clockOut, clockOutState] = useMutation(CLOCK_OUT_MUTATION)
  const openQuery = useQuery<{ attendanceRecords: OpenRecord[] }>(OPEN_ATTENDANCE_QUERY, {
    variables: { filter: { employeeId, status: 'CLOCKED_IN' } },
    skip: !employeeId,
    fetchPolicy: 'network-only',
  })
  const openRecord = employeeId ? openQuery.data?.attendanceRecords?.[0] ?? null : null

  const employee = employees.find((e) => e.id === employeeId) ?? null
  const assignments = useMemo(
    () => (employeeId ? (assignmentsFor(employeeId) ?? []).filter((a) => a.location.isActive) : []),
    [assignmentsFor, employeeId],
  )

  // Clocking out happens at the site of the open record; otherwise default
  // to the primary assignment.
  const effectiveSiteId = openRecord ? openRecord.location.id : siteId
  const site =
    sites.find((s) => s.id === effectiveSiteId) ??
    assignments.find((a) => a.location.id === effectiveSiteId)?.location ??
    null

  useEffect(() => {
    if (!employeeId) return
    const primary = assignments.find((a) => a.isPrimary) ?? assignments[0]
    setSiteId(primary?.location.id ?? '')
  }, [employeeId, assignments])

  useEffect(() => {
    if (!manual && site) {
      setLatitude(String(site.latitude))
      setLongitude(String(site.longitude))
    }
  }, [site, manual])

  const busy = clockInState.loading || clockOutState.loading
  const noSite = Boolean(employeeId) && !assignmentsLoading && assignments.length === 0 && !openRecord

  const coordinates = () => {
    const lat = Number.parseFloat(latitude)
    const lng = Number.parseFloat(longitude)
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return 'Latitude must be between −90 and 90.'
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) return 'Longitude must be between −180 and 180.'
    return { latitude: lat, longitude: lng }
  }

  const record = async (kind: 'in' | 'out') => {
    setError(null)
    setSuccess(null)
    if (!employee) {
      setError('Choose an employee.')
      return
    }
    if (kind === 'in' && !siteId) {
      setError('Choose a work site.')
      return
    }
    const coords = coordinates()
    if (typeof coords === 'string') {
      setManual(true)
      setError(coords)
      return
    }
    try {
      if (kind === 'in') {
        await clockIn({ variables: { input: { employeeId, locationId: siteId, ...coords, notes: notes.trim() || null } } })
        setSuccess(`${employee.fullName} clocked in at ${site?.name ?? 'the site'}.`)
      } else {
        await clockOut({ variables: { input: { employeeId, ...coords, notes: notes.trim() || null } } })
        setSuccess(`${employee.fullName} clocked out.`)
      }
      setNotes('')
      await openQuery.refetch()
      onRecorded()
    } catch (mutationError) {
      setError(readableError(mutationError, kind === 'in' ? 'Clock in failed.' : 'Clock out failed.'))
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <SectionHeading description="Clock someone in or out on their behalf." title="Record attendance" />

        <SelectField
          id="attendance-employee"
          label="Employee"
          onChange={(value) => {
            setEmployeeId(value)
            setError(null)
            setSuccess(null)
            setManual(false)
          }}
          options={employees
            .filter((e) => e.isActive)
            .sort((a, b) => a.fullName.localeCompare(b.fullName))
            .map((e) => ({ value: e.id, label: `${e.fullName} · ${e.employeeNumber}` }))}
          placeholder="Choose an employee"
          value={employeeId}
        />

        {employeeId && openRecord ? (
          <div className="rounded-xl border border-sky-200 bg-sky-50/70 px-3.5 py-3 text-sm text-sky-950">
            Clocked in since <span className="font-semibold">{formatTime(openRecord.clockInAt)}</span>
            {openRecord.attendanceDate ? ` on ${formatDay(openRecord.attendanceDate)}` : ''} at{' '}
            <span className="font-semibold">{openRecord.location.name}</span>.
          </div>
        ) : null}

        {noSite ? (
          <Notice tone="warning">
            {employee?.fullName} is not assigned to a work site yet, so attendance cannot be recorded.{' '}
            <Link className="font-semibold text-primary underline-offset-4 hover:underline" to="/employees">
              Go to People
            </Link>{' '}
            and choose <span className="font-medium">Assign site</span> from their row menu.
          </Notice>
        ) : null}

        {employeeId && !openRecord && assignments.length > 0 ? (
          <SelectField
            hint={site ? `Checked against a ${formatNumber(site.geofenceRadius)} m radius around the site.` : undefined}
            id="attendance-site"
            label="Work site"
            onChange={(value) => {
              setSiteId(value)
              setManual(false)
            }}
            options={assignments.map((a) => ({
              value: a.location.id,
              label: a.isPrimary ? `${a.location.name} (primary)` : a.location.name,
            }))}
            value={siteId}
          />
        ) : null}

        {employeeId && (assignments.length > 0 || openRecord) ? (
          <>
            <details
              className="group rounded-xl border border-border/70 px-3.5 py-2.5"
              onToggle={(event) => setManual((event.target as HTMLDetailsElement).open)}
              open={manual}
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
                Enter coordinates manually
              </summary>
              <p className="mt-2 text-[13px] leading-5 text-muted-foreground">
                By default the site centre is used{site ? ` (${site.latitude.toFixed(4)}, ${site.longitude.toFixed(4)})` : ''}. Change it only
                to record a position the person reported.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <TextField hint="−90 to 90" id="attendance-latitude" label="Latitude">
                  <Input id="attendance-latitude" inputMode="decimal" onChange={(e) => setLatitude(e.target.value)} value={latitude} />
                </TextField>
                <TextField hint="−180 to 180" id="attendance-longitude" label="Longitude">
                  <Input id="attendance-longitude" inputMode="decimal" onChange={(e) => setLongitude(e.target.value)} value={longitude} />
                </TextField>
              </div>
            </details>

            <TextField id="attendance-notes" label="Note" optional>
              <Input id="attendance-notes" onChange={(e) => setNotes(e.target.value)} placeholder="For example, forgot to clock in from the app" value={notes} />
            </TextField>
          </>
        ) : null}

        {error ? <Notice tone="danger">{error}</Notice> : null}
        {success ? <Notice tone="success">{success}</Notice> : null}

        <div className="grid grid-cols-2 gap-2">
          <Button
            disabled={busy || !employeeId || Boolean(openRecord) || assignments.length === 0}
            onClick={() => void record('in')}
            type="button"
            variant={openRecord ? 'outline' : 'default'}
          >
            <LogIn className="mr-2 h-4 w-4" />
            {clockInState.loading ? 'Saving…' : 'Clock in'}
          </Button>
          <Button
            disabled={busy || !openRecord}
            onClick={() => void record('out')}
            type="button"
            variant={openRecord ? 'default' : 'outline'}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {clockOutState.loading ? 'Saving…' : 'Clock out'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function statusTone(status: string) {
  if (status === 'CLOCKED_IN') return 'info' as const
  if (status === 'COMPLETED') return 'success' as const
  return 'neutral' as const
}

function hoursLabel(record: AttendanceRecord) {
  if (record.totalHours === null || record.totalHours === undefined) {
    return '—'
  }
  return `${formatNumber(record.totalHours, 1)} h`
}

export function RecordsTable({ records }: { records: AttendanceRecord[] }) {
  if (records.length === 0) {
    return <EmptyState title="No attendance in this view">Change the employee or date, or record attendance on the left.</EmptyState>
  }
  return (
    <DataTable label="Attendance records" minWidth={600}>
      <thead>
        <tr>
          <Th>Date</Th>
          <Th>Employee</Th>
          <Th>Work site</Th>
          <Th>Time</Th>
          <Th className="text-right">Hours</Th>
        </tr>
      </thead>
      <tbody>
        {records.map((record) => (
          <Tr key={record.id}>
            <Td className="whitespace-nowrap tabular-nums">{formatDay(record.attendanceDate)}</Td>
            <Td className="max-w-[180px]">
              <p className="truncate font-medium" title={`${record.employee.fullName} · ${record.employee.employeeNumber}`}>
                {record.employee.fullName}
              </p>
            </Td>
            <Td className="max-w-[180px]">
              <p className="truncate" title={record.location.name}>{record.location.name}</p>
            </Td>
            <Td className="whitespace-nowrap tabular-nums">
              {formatTime(record.clockInAt)}
              {record.clockOutAt ? ` – ${formatTime(record.clockOutAt)}` : null}
              {record.status !== 'COMPLETED' ? (
                <StatusBadge className="ml-2 whitespace-nowrap" tone={statusTone(record.status)}>
                  {formatStatus(record.status)}
                </StatusBadge>
              ) : null}
            </Td>
            <Td className="whitespace-nowrap text-right tabular-nums">{hoursLabel(record)}</Td>
          </Tr>
        ))}
      </tbody>
    </DataTable>
  )
}
