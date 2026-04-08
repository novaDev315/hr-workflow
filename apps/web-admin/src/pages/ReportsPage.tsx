import { useState } from 'react'
import { gql, useApolloClient, useQuery } from '@apollo/client'
import { Download, FileText, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { MetricCard } from '@/components/ui/metric-card'
import { Notice } from '@/components/ui/notice'
import { StatusBadge } from '@/components/ui/status-badge'
import { downloadBase64File } from '@/lib/download-export'
import { formatCurrency, formatDate } from '@/lib/utils'

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

export function ReportsPage() {
  const apolloClient = useApolloClient()
  const [periodMonth, setPeriodMonth] = useState(new Date().toISOString().slice(0, 7))
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const { data, loading, error } = useQuery(REPORTS_DASHBOARD_QUERY, {
    variables: { periodMonth },
  })

  const dashboard = data?.reportsDashboard

  const handleExportReports = async () => {
    setExporting(true)
    setExportError(null)

    try {
      const { data: exportData } = await apolloClient.query({
        query: EXPORT_REPORTS_PDF_QUERY,
        variables: { periodMonth },
        fetchPolicy: 'no-cache',
      })

      const exportPayload = exportData?.exportReportsPdf
      if (!exportPayload) {
        throw new Error('Report export is unavailable.')
      }

      downloadBase64File(
        exportPayload.fileName,
        exportPayload.mimeType,
        exportPayload.contentBase64
      )
    } catch (queryError) {
      setExportError(
        queryError instanceof Error ? queryError.message : 'Unable to export the selected report.'
      )
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
          <div>
            <p className="app-kicker">Monthly reporting</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
              Export the essentials for leadership.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Reports stay compact here: scope, people movement, payroll weight, and approval pressure.
            </p>
          </div>
          <div className="flex w-full max-w-md gap-3">
            <Input type="month" value={periodMonth} onChange={(event) => setPeriodMonth(event.target.value)} />
            <Button type="button" variant="outline" onClick={handleExportReports} disabled={exporting}>
              <Download className="mr-2 h-4 w-4" />
              {exporting ? 'Exporting...' : 'Export PDF'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {exportError ? <Notice tone="danger">{exportError}</Notice> : null}

      {loading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Loading reports...</CardContent>
        </Card>
      ) : error ? (
        <Notice tone="danger">Unable to load reports. {error.message}</Notice>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              detail={dashboard?.accessScopeLabel ?? 'Current scope'}
              icon={Users}
              label="Active employees"
              tone="bg-sky-100 text-sky-800"
              value={String(dashboard?.overview.activeEmployees ?? 0)}
            />
            <MetricCard
              detail="Waiting for review"
              icon={FileText}
              label="Pending leave"
              tone="bg-amber-100 text-amber-800"
              value={String(dashboard?.overview.pendingLeaveRequests ?? 0)}
            />
            <MetricCard
              detail="Completed cycles"
              label="Payroll periods"
              tone="bg-emerald-100 text-emerald-800"
              value={String(dashboard?.overview.processedPayrollPeriods ?? 0)}
            />
            <MetricCard
              detail={`${dashboard?.overview.publishedPolicies ?? 0} published policies`}
              label="Monthly net pay"
              tone="bg-rose-100 text-rose-800"
              value={formatCurrency(dashboard?.overview.monthlyPayrollNetPay ?? 0)}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <p className="app-kicker">Headcount</p>
                <CardTitle>Department overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboard?.departmentHeadcount.map((row: { departmentName: string; employeeCount: number }) => (
                  <div key={row.departmentName} className="app-muted-surface p-4">
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-semibold text-foreground">{row.departmentName}</p>
                      <StatusBadge tone="neutral">{row.employeeCount} employees</StatusBadge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <p className="app-kicker">Payroll</p>
                <CardTitle>Department cost weight</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboard?.payrollDepartmentCosts.map(
                  (row: { departmentName: string; payslipCount: number; totalNetPay: number }) => (
                    <div key={row.departmentName} className="app-muted-surface p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-foreground">{row.departmentName}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {row.payslipCount} payslips
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                          {formatCurrency(row.totalNetPay)}
                        </p>
                      </div>
                    </div>
                  )
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <p className="app-kicker">People movement</p>
                <CardTitle>Recent hires and attendance signal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {dashboard?.recentHires.map(
                    (row: {
                      employeeNumber: string
                      fullName: string
                      departmentName: string
                      designationTitle: string
                      joinDate: string
                    }) => (
                      <div key={`${row.employeeNumber}-${row.joinDate}`} className="app-muted-surface p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-foreground">{row.fullName}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {row.departmentName} · {row.designationTitle}
                            </p>
                          </div>
                          <StatusBadge tone="info">{formatDate(row.joinDate)}</StatusBadge>
                        </div>
                      </div>
                    )
                  )}
                </div>

                <div className="space-y-3 border-t border-border/70 pt-4">
                  {dashboard?.attendanceSummary.map(
                    (row: {
                      employeeNumber: string
                      fullName: string
                      attendanceDays: number
                      overtimeHours: number
                    }) => (
                      <div key={row.employeeNumber} className="app-muted-surface p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-foreground">{row.fullName}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{row.employeeNumber}</p>
                          </div>
                          <StatusBadge tone="accent">{row.attendanceDays} days</StatusBadge>
                        </div>
                        <p className="mt-3 text-sm text-muted-foreground">
                          Overtime: {row.overtimeHours.toFixed(2)} hours
                        </p>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <p className="app-kicker">Governance</p>
                <CardTitle>Approvals and published policy</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {dashboard?.pendingLeaveApprovals.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No pending leave approvals.</p>
                  ) : (
                    dashboard?.pendingLeaveApprovals.map(
                      (row: {
                        employeeNumber: string
                        fullName: string
                        leaveTypeName: string
                        startDate: string
                        endDate: string
                        totalDays: number
                      }) => (
                        <div key={`${row.employeeNumber}-${row.startDate}`} className="app-muted-surface p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-foreground">{row.fullName}</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {row.leaveTypeName} · {formatDate(row.startDate)} to {formatDate(row.endDate)}
                              </p>
                            </div>
                            <StatusBadge tone="warning">{row.totalDays} days</StatusBadge>
                          </div>
                        </div>
                      )
                    )
                  )}
                </div>

                <div className="space-y-3 border-t border-border/70 pt-4">
                  {dashboard?.publishedPolicies.map(
                    (row: {
                      title: string
                      category: string
                      version: string
                      effectiveDate: string
                    }) => (
                      <div key={`${row.title}-${row.version}`} className="app-muted-surface p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-foreground">{row.title}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {row.category} · Effective {formatDate(row.effectiveDate)}
                            </p>
                          </div>
                          <StatusBadge tone="neutral">v{row.version}</StatusBadge>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
