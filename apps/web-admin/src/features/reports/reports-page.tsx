import { useState } from 'react'
import { gql, useApolloClient, useQuery } from '@apollo/client'
import { ArrowRight, Download, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'

import { AdminHero } from '@/components/admin/admin-hero'
import {
  AdminTable,
  AdminTableCell,
  AdminTableEmpty,
  AdminTableHead,
  AdminTableRow,
} from '@/components/admin/admin-table'
import { PageFeedback } from '@/components/admin/page-feedback'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MetricCard } from '@/components/ui/metric-card'
import { downloadBase64File } from '@/lib/download-export'
import {
  currentMonthLocal,
  formatDay,
  formatDayRange,
  formatMoney,
  formatMonth,
  formatNumber,
  plural,
  todayLocal,
} from '@/lib/format'
import { readableError } from '@/lib/graphql-errors'

import { DepartmentBarChart } from './department-bar-chart'
import { useCanViewPayroll } from './use-can-view-payroll'

const REPORTS_DASHBOARD_QUERY = gql`
  query ReportsDashboard($periodMonth: String) {
    reportsDashboard(periodMonth: $periodMonth) {
      accessScopeLabel
      overview {
        activeEmployees
        pendingLeaveRequests
        processedPayrollPeriods
        publishedPolicies
        monthlyPayrollNetPay
      }
      departmentHeadcount {
        departmentName
        employeeCount
      }
      recentHires {
        employeeNumber
        fullName
        joinDate
        departmentName
        designationTitle
      }
      attendanceSummary {
        employeeNumber
        fullName
        attendanceDays
        overtimeHours
      }
      payrollDepartmentCosts {
        departmentName
        payslipCount
        totalNetPay
      }
      pendingLeaveApprovals {
        employeeNumber
        fullName
        leaveTypeName
        startDate
        endDate
        totalDays
      }
      publishedPolicies {
        title
        category
        version
        effectiveDate
      }
    }
  }
`

const EXPORT_REPORTS_PDF_QUERY = gql`
  query ExportReportsPdf($periodMonth: String) {
    exportReportsPdf(periodMonth: $periodMonth) {
      fileName
      mimeType
      contentBase64
    }
  }
`

type ReportsDashboard = {
  accessScopeLabel: string
  overview: {
    activeEmployees: number
    pendingLeaveRequests: number
    processedPayrollPeriods: number
    publishedPolicies: number
    monthlyPayrollNetPay: number
  }
  departmentHeadcount: Array<{ departmentName: string; employeeCount: number }>
  recentHires: Array<{
    employeeNumber: string
    fullName: string
    joinDate: string
    departmentName: string
    designationTitle: string
  }>
  attendanceSummary: Array<{
    employeeNumber: string
    fullName: string
    attendanceDays: number
    overtimeHours: number
  }>
  payrollDepartmentCosts: Array<{ departmentName: string; payslipCount: number; totalNetPay: number }>
  pendingLeaveApprovals: Array<{
    employeeNumber: string
    fullName: string
    leaveTypeName: string
    startDate: string
    endDate: string
    totalDays: number
  }>
  publishedPolicies: Array<{ title: string; category: string; version: string; effectiveDate: string }>
}

function daysAgo(isoDay: string, days: number) {
  const date = new Date(`${isoDay}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}

export function ReportsPage() {
  const apolloClient = useApolloClient()
  const [periodMonth, setPeriodMonth] = useState(currentMonthLocal())
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const { canViewPayroll } = useCanViewPayroll(periodMonth)
  const { data, loading, error } = useQuery<{ reportsDashboard: ReportsDashboard }>(
    REPORTS_DASHBOARD_QUERY,
    { variables: { periodMonth } },
  )

  const dashboard = data?.reportsDashboard
  const monthLabel = formatMonth(periodMonth)
  const today = todayLocal()
  const hiresSince = daysAgo(today, 90)

  const departmentHeadcount = dashboard?.departmentHeadcount ?? []
  const netPay = dashboard?.overview.monthlyPayrollNetPay ?? 0
  const payrollCosts = (dashboard?.payrollDepartmentCosts ?? []).filter((row) => row.payslipCount > 0)
  const recentHires = (dashboard?.recentHires ?? []).filter(
    (hire) => hire.joinDate >= hiresSince && hire.joinDate <= today,
  )
  const attendance = [...(dashboard?.attendanceSummary ?? [])].sort(
    (a, b) => b.attendanceDays - a.attendanceDays || a.fullName.localeCompare(b.fullName),
  )
  const attendanceRecorded = attendance.some((row) => row.attendanceDays > 0)
  const pendingLeave = dashboard?.pendingLeaveApprovals ?? []
  const publishedPolicies = dashboard?.publishedPolicies ?? []
  const processedPeriods = dashboard?.overview.processedPayrollPeriods ?? 0

  const handleExportReports = async () => {
    setExporting(true)
    setExportError(null)
    try {
      const { data: exportData } = await apolloClient.query({
        query: EXPORT_REPORTS_PDF_QUERY,
        variables: { periodMonth },
        fetchPolicy: 'no-cache',
      })
      const payload = exportData?.exportReportsPdf
      if (!payload) throw new Error('This report could not be exported.')
      downloadBase64File(payload.fileName, payload.mimeType, payload.contentBase64)
    } catch (queryError) {
      setExportError(readableError(queryError, 'Could not export the report.'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="min-w-0 space-y-4">
      <AdminHero
        title="Reports"
        description="Headcount, attendance, payroll and approvals for one month."
        actions={
          <>
            <Label htmlFor="report-month" className="sr-only">
              Report month
            </Label>
            <Input
              id="report-month"
              type="month"
              className="w-[11.5rem]"
              value={periodMonth}
              onChange={(event) => event.target.value && setPeriodMonth(event.target.value)}
            />
            <Button type="button" variant="outline" onClick={handleExportReports} disabled={exporting}>
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Export PDF
            </Button>
          </>
        }
      />

      <PageFeedback errorMessage={exportError} />

      {loading && !dashboard ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Loading reports…</CardContent>
        </Card>
      ) : error && !dashboard ? (
        <PageFeedback loadError={error} loadErrorPrefix="Reports could not be loaded." />
      ) : (
        <>
          <div className={canViewPayroll ? 'grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4' : 'grid grid-cols-2 gap-2 sm:gap-3'}>
            <MetricCard
              label="Active employees"
              value={String(dashboard?.overview.activeEmployees ?? 0)}
              detail={dashboard?.accessScopeLabel ?? 'Current scope'}
            />
            <MetricCard
              label="Pending leave"
              value={String(dashboard?.overview.pendingLeaveRequests ?? 0)}
              detail={
                (dashboard?.overview.pendingLeaveRequests ?? 0) === 0
                  ? 'No requests waiting'
                  : 'Waiting for review'
              }
            />
            {canViewPayroll ? (
              <>
                <MetricCard
                  label="Net pay"
                  value={formatMoney(netPay)}
                  detail={netPay > 0 ? `Payslips for ${monthLabel}` : 'Not processed for this month'}
                />
                <MetricCard
                  label="Processed payroll periods"
                  value={String(processedPeriods)}
                  detail="All months to date"
                />
              </>
            ) : null}
          </div>

          <div className={canViewPayroll ? 'grid min-w-0 gap-4 xl:grid-cols-2' : 'grid min-w-0 gap-4'}>
            <Card className="min-w-0">
              <CardHeader className="pb-2">
                <CardTitle>Headcount by department</CardTitle>
                <CardDescription>Active employees today.</CardDescription>
              </CardHeader>
              <CardContent>
                {departmentHeadcount.length === 0 ? (
                  <AdminTableEmpty>No active employees in any department yet.</AdminTableEmpty>
                ) : (
                  <DepartmentBarChart
                    caption="Headcount by department"
                    valueLabel="Employees"
                    formatValue={(value) => formatNumber(value)}
                    data={departmentHeadcount.map((row) => ({
                      name: row.departmentName,
                      value: row.employeeCount,
                    }))}
                  />
                )}
              </CardContent>
            </Card>

            {canViewPayroll ? (
              <Card className="min-w-0">
                <CardHeader className="pb-2">
                  <CardTitle>Payroll cost by department</CardTitle>
                  <CardDescription>Net pay for {monthLabel}.</CardDescription>
                </CardHeader>
                <CardContent>
                  {payrollCosts.length === 0 ? (
                    <AdminTableEmpty>No payroll processed for {monthLabel}.</AdminTableEmpty>
                  ) : (
                    <DepartmentBarChart
                      caption={`Payroll cost by department, ${monthLabel}`}
                      valueLabel="Net pay"
                      formatValue={(value) => formatMoney(value)}
                      data={payrollCosts.map((row) => ({
                        name: row.departmentName,
                        value: row.totalNetPay,
                        detail: plural(row.payslipCount, 'payslip'),
                      }))}
                    />
                  )}
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <Card className="min-w-0">
              <CardHeader className="pb-2">
                <CardTitle>Attendance</CardTitle>
                <CardDescription>Days attended and overtime in {monthLabel}.</CardDescription>
              </CardHeader>
              <CardContent>
                {attendance.length === 0 || !attendanceRecorded ? (
                  <AdminTableEmpty>No attendance recorded for {monthLabel}.</AdminTableEmpty>
                ) : (
                  <AdminTable caption={`Attendance, ${monthLabel}`} density="compact">
                    <thead>
                      <tr>
                        <AdminTableHead>Employee</AdminTableHead>
                        <AdminTableHead numeric>Days attended</AdminTableHead>
                        <AdminTableHead numeric>Overtime</AdminTableHead>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.map((row) => (
                        <AdminTableRow key={row.employeeNumber}>
                          <AdminTableCell nowrap>
                            <bdi className="font-medium text-foreground">{row.fullName}</bdi>
                            <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">{row.employeeNumber}</span>
                          </AdminTableCell>
                          <AdminTableCell numeric>{formatNumber(row.attendanceDays)}</AdminTableCell>
                          <AdminTableCell numeric>
                            {row.overtimeHours > 0 ? `${formatNumber(row.overtimeHours, 1)} h` : '—'}
                          </AdminTableCell>
                        </AdminTableRow>
                      ))}
                    </tbody>
                  </AdminTable>
                )}
              </CardContent>
            </Card>

            <div className="min-w-0 space-y-4">
              <Card className="min-w-0">
                <CardHeader className="pb-2">
                  <CardTitle>Recent hires</CardTitle>
                  <CardDescription>Joined in the last 90 days.</CardDescription>
                </CardHeader>
                <CardContent>
                  {recentHires.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No one joined in the last 90 days.</p>
                  ) : (
                    <ul className="divide-y divide-border/70">
                      {recentHires.map((hire) => (
                        <li key={hire.employeeNumber} className="flex min-w-0 items-center justify-between gap-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground"><bdi>{hire.fullName}</bdi></p>
                            <p className="truncate text-[13px] text-muted-foreground">
                              {hire.designationTitle} · {hire.departmentName}
                            </p>
                          </div>
                          <span className="shrink-0 whitespace-nowrap text-[13px] text-muted-foreground tabular-nums">
                            {formatDay(hire.joinDate)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card className="min-w-0">
                <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-2">
                  <CardTitle>Leave waiting for review</CardTitle>
                  {pendingLeave.length > 0 ? (
                    <Link
                      className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      to="/leave"
                    >
                      Review
                      <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                </CardHeader>
                <CardContent>
                  {pendingLeave.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No leave requests waiting.</p>
                  ) : (
                    <ul className="divide-y divide-border/70">
                      {pendingLeave.map((leave) => (
                        <li key={`${leave.employeeNumber}-${leave.startDate}`} className="flex min-w-0 items-center justify-between gap-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground"><bdi>{leave.fullName}</bdi></p>
                            <p className="truncate text-[13px] text-muted-foreground">
                              {leave.leaveTypeName} · {formatDayRange(leave.startDate, leave.endDate)}
                            </p>
                          </div>
                          <span className="shrink-0 whitespace-nowrap text-[13px] text-muted-foreground tabular-nums">
                            {plural(leave.totalDays, 'day')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card className="min-w-0">
                <CardHeader className="pb-2">
                  <CardTitle>Published policies</CardTitle>
                </CardHeader>
                <CardContent>
                  {publishedPolicies.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No published policies yet.</p>
                  ) : (
                    <ul className="divide-y divide-border/70">
                      {publishedPolicies.map((policy) => (
                        <li key={`${policy.title}-${policy.version}`} className="flex min-w-0 items-center justify-between gap-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{policy.title}</p>
                            <p className="truncate text-[13px] text-muted-foreground">
                              {policy.category} · version {policy.version}
                            </p>
                          </div>
                          <span className="shrink-0 whitespace-nowrap text-[13px] text-muted-foreground tabular-nums">
                            {formatDay(policy.effectiveDate)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
