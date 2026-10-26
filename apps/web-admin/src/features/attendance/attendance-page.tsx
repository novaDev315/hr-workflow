import { useQuery } from '@apollo/client'
import { Clock3, MapPin, UserCheck, Users } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { MetricCard } from '@/components/ui/metric-card'
import { Notice } from '@/components/ui/notice'
import { FilterSelect } from '@/features/shared/controls'
import { PageIntro, SectionHeading } from '@/features/shared/page-intro'
import { useReferenceData, useSiteAssignments } from '@/features/shared/reference-data'
import { formatDay, plural, todayLocal } from '@/lib/format'

import { RecordAttendanceCard, RecordsTable } from './components'
import { ATTENDANCE_WORKSPACE_QUERY } from './graphql'
import type { AttendanceEmployee, AttendanceRecord } from './types'

export function AttendancePage() {
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  const filter = {
    ...(employeeFilter ? { employeeId: employeeFilter } : {}),
    ...(dateFilter ? { fromDate: dateFilter, toDate: dateFilter } : {}),
  }
  const workspace = useQuery<{ employees: AttendanceEmployee[]; attendanceRecords: AttendanceRecord[] }>(
    ATTENDANCE_WORKSPACE_QUERY,
    { variables: { filter: Object.keys(filter).length ? filter : null } },
  )
  const reference = useReferenceData()

  const employees = useMemo(() => workspace.data?.employees ?? [], [workspace.data])
  const activeEmployees = useMemo(() => employees.filter((e) => e.isActive), [employees])
  const records = workspace.data?.attendanceRecords ?? []
  const assignments = useSiteAssignments(activeEmployees.map((e) => e.id))
  const assignmentsFor = useCallback((id: string) => assignments.byEmployee.get(id), [assignments.byEmployee])

  const withSite = activeEmployees.filter((e) =>
    (assignments.byEmployee.get(e.id) ?? []).some((a) => a.location.isActive),
  ).length
  const activeSites = reference.sites.filter((s) => s.isActive).length
  const stillIn = records.filter((r) => r.status === 'CLOCKED_IN').length
  const employeeName = employees.find((e) => e.id === employeeFilter)?.fullName
  const scope = [employeeName, dateFilter ? formatDay(dateFilter) : 'all dates'].filter(Boolean).join(' · ')

  return (
    <div className="space-y-5">
      <PageIntro
        actions={
          <Button asChild variant="outline">
            <Link to="/organisation#sites">
              <MapPin className="mr-2 h-4 w-4" />
              Manage work sites
            </Link>
          </Button>
        }
        description="Record clock-ins for people without the app and review time at each site."
        title="Attendance"
      />

      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <MetricCard detail={scope.charAt(0).toUpperCase() + scope.slice(1)} icon={Clock3} label="Records shown" value={String(records.length)} />
        <MetricCard detail="In this view" icon={UserCheck} label="Still clocked in" value={String(stillIn)} />
        <MetricCard
          detail={`Of ${plural(activeEmployees.length, 'active employee')}`}
          icon={Users}
          label="Employees with a site"
          value={assignments.data || activeEmployees.length === 0 ? String(withSite) : '…'}
        />
        <MetricCard detail="Where people clock in" icon={MapPin} label="Active work sites" value={String(activeSites)} />
      </div>

      {workspace.error ? <Notice tone="danger">Attendance could not be loaded. {workspace.error.message}</Notice> : null}
      {!reference.loading && activeSites === 0 ? (
        <Notice tone="warning">
          No work sites exist yet. <Link className="font-semibold text-primary underline-offset-4 hover:underline" to="/organisation#sites">Add one in Organisation</Link>, then assign people to it from People.
        </Notice>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="xl:sticky xl:top-[92px] xl:self-start">
          <RecordAttendanceCard
            assignmentsFor={assignmentsFor}
            assignmentsLoading={assignments.loading && !assignments.data}
            employees={employees}
            onRecorded={() => void workspace.refetch()}
            sites={reference.sites}
          />
        </div>

        <Card className="min-w-0">
          <CardContent className="space-y-4 p-4 sm:p-5">
            <SectionHeading description="Most recent first." title="Records" />
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_200px_auto]">
              <FilterSelect
                allLabel="All employees"
                id="attendance-filter-employee"
                label="Filter records by employee"
                onChange={setEmployeeFilter}
                options={employees
                  .slice()
                  .sort((a, b) => a.fullName.localeCompare(b.fullName))
                  .map((e) => ({ value: e.id, label: e.fullName }))}
                value={employeeFilter}
              />
              <div>
                <label className="sr-only" htmlFor="attendance-filter-date">Date</label>
                <Input
                  className="h-10"
                  id="attendance-filter-date"
                  onChange={(event) => setDateFilter(event.target.value)}
                  type="date"
                  value={dateFilter}
                />
              </div>
              <div className="flex gap-2">
                <Button className="h-10" onClick={() => setDateFilter(todayLocal())} type="button" variant="outline">
                  Today
                </Button>
                {dateFilter || employeeFilter ? (
                  <Button
                    className="h-10"
                    onClick={() => {
                      setDateFilter('')
                      setEmployeeFilter('')
                    }}
                    type="button"
                    variant="ghost"
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
            </div>
            {workspace.loading && !workspace.data ? (
              <p className="text-sm text-muted-foreground">Loading records…</p>
            ) : (
              <RecordsTable records={records} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
