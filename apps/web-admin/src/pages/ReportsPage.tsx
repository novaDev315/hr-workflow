import { gql, useApolloClient, useQuery } from '@apollo/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useState } from 'react'
import { downloadBase64File } from '@/lib/download-export'

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
    variables: {
      periodMonth,
    },
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">
            Live operational reports across employees, attendance, leave, payroll, and policy.
          </p>
        </div>
        <div className="flex w-full max-w-md gap-3">
          <Input type="month" value={periodMonth} onChange={(event) => setPeriodMonth(event.target.value)} />
          <Button type="button" variant="outline" onClick={handleExportReports} disabled={exporting}>
            {exporting ? 'Exporting...' : 'Export PDF'}
          </Button>
        </div>
      </div>

      {exportError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">{exportError}</CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Loading reports...
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-sm text-red-600">
            Unable to load reports. {error.message}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="flex items-center justify-between p-4 text-sm">
              <span className="font-medium">Report scope</span>
              <span className="text-muted-foreground">
                {dashboard?.accessScopeLabel ?? 'Current account scope'}
              </span>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {[
              { label: 'Active Employees', value: dashboard?.overview.activeEmployees ?? 0 },
              { label: 'Pending Leave', value: dashboard?.overview.pendingLeaveRequests ?? 0 },
              { label: 'Processed Payrolls', value: dashboard?.overview.processedPayrollPeriods ?? 0 },
              { label: 'Published Policies', value: dashboard?.overview.publishedPolicies ?? 0 },
              {
                label: 'Monthly Net Pay',
                value: (dashboard?.overview.monthlyPayrollNetPay ?? 0).toFixed(2),
              },
            ].map((item) => (
              <Card key={item.label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">{item.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{item.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Department Headcount</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboard?.departmentHeadcount.map((row: { departmentName: string; employeeCount: number }) => (
                  <div key={row.departmentName} className="flex items-center justify-between rounded-md border p-3">
                    <span className="font-medium">{row.departmentName}</span>
                    <span className="text-sm text-muted-foreground">{row.employeeCount} employees</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payroll Cost by Department</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboard?.payrollDepartmentCosts.map(
                  (row: { departmentName: string; payslipCount: number; totalNetPay: number }) => (
                    <div key={row.departmentName} className="rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{row.departmentName}</span>
                        <span className="text-sm text-muted-foreground">
                          {row.payslipCount} payslips
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Net pay: {row.totalNetPay.toFixed(2)}
                      </p>
                    </div>
                  )
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Hires</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-3 text-left">Employee</th>
                        <th className="px-4 py-3 text-left">Department</th>
                        <th className="px-4 py-3 text-left">Designation</th>
                        <th className="px-4 py-3 text-left">Join Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard?.recentHires.map(
                        (row: {
                          employeeNumber: string
                          fullName: string
                          departmentName: string
                          designationTitle: string
                          joinDate: string
                        }) => (
                          <tr key={`${row.employeeNumber}-${row.joinDate}`} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3">
                              {row.fullName}
                              <div className="text-xs text-muted-foreground">{row.employeeNumber}</div>
                            </td>
                            <td className="px-4 py-3">{row.departmentName}</td>
                            <td className="px-4 py-3">{row.designationTitle}</td>
                            <td className="px-4 py-3">{row.joinDate}</td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Attendance Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-3 text-left">Employee</th>
                        <th className="px-4 py-3 text-left">Attendance Days</th>
                        <th className="px-4 py-3 text-left">Overtime Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard?.attendanceSummary.map(
                        (row: {
                          employeeNumber: string
                          fullName: string
                          attendanceDays: number
                          overtimeHours: number
                        }) => (
                          <tr key={row.employeeNumber} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3">
                              {row.fullName}
                              <div className="text-xs text-muted-foreground">{row.employeeNumber}</div>
                            </td>
                            <td className="px-4 py-3">{row.attendanceDays}</td>
                            <td className="px-4 py-3">{row.overtimeHours.toFixed(2)}</td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Pending Leave Approval</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
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
                      <div key={`${row.employeeNumber}-${row.startDate}`} className="rounded-md border p-3">
                        <p className="font-medium">
                          {row.fullName} <span className="text-sm text-muted-foreground">({row.employeeNumber})</span>
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {row.leaveTypeName} • {row.startDate} to {row.endDate} • {row.totalDays} day(s)
                        </p>
                      </div>
                    )
                  )
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Published Policies</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboard?.publishedPolicies.map(
                  (row: {
                    title: string
                    category: string
                    version: string
                    effectiveDate: string
                  }) => (
                    <div key={`${row.title}-${row.version}`} className="rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{row.title}</p>
                        <span className="text-xs text-muted-foreground">v{row.version}</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {row.category} • Effective {row.effectiveDate}
                      </p>
                    </div>
                  )
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
