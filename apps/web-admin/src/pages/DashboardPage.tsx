import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Briefcase, Calendar, DollarSign } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { gql, useQuery } from '@apollo/client'

const DASHBOARD_QUERY = gql`
  query DashboardReports($periodMonth: String) {
    reportsDashboard(periodMonth: $periodMonth) {
      accessScopeLabel
      overview {
        activeEmployees
        pendingLeaveRequests
        processedPayrollPeriods
        publishedPolicies
        monthlyPayrollNetPay
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

export function DashboardPage() {
  const periodMonth = new Date().toISOString().slice(0, 7)
  const { data, loading, error } = useQuery(DASHBOARD_QUERY, {
    variables: {
      periodMonth,
    },
  })

  const dashboard = data?.reportsDashboard
  const stats = [
    {
      title: 'Total Employees',
      value: String(dashboard?.overview.activeEmployees ?? 0),
      icon: Users,
      change: dashboard?.accessScopeLabel ?? 'Current scope',
    },
    {
      title: 'Pending Leave',
      value: String(dashboard?.overview.pendingLeaveRequests ?? 0),
      icon: Briefcase,
      change: 'Requests awaiting review',
    },
    {
      title: 'Processed Payrolls',
      value: String(dashboard?.overview.processedPayrollPeriods ?? 0),
      icon: Calendar,
      change: `Published policies: ${dashboard?.overview.publishedPolicies ?? 0}`,
    },
    {
      title: 'Monthly Payroll',
      value: formatCurrency(dashboard?.overview.monthlyPayrollNetPay ?? 0),
      icon: DollarSign,
      change: `Reporting month: ${periodMonth}`,
    },
  ]

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Loading dashboard...
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-red-600">
          Unable to load dashboard. {error.message}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Live overview of your HR operations
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Hires</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard?.recentHires.length ? (
              dashboard.recentHires.map((hire: {
                employeeNumber: string
                fullName: string
                joinDate: string
                departmentName: string
                designationTitle: string
              }) => (
                <div
                  key={`${hire.employeeNumber}-${hire.joinDate}`}
                  className="rounded-md border p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{hire.fullName}</p>
                      <p className="text-xs text-muted-foreground">{hire.employeeNumber}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{hire.joinDate}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {hire.departmentName} · {hire.designationTitle}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No hires found for this scope yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Leave Approvals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard?.pendingLeaveApprovals.length ? (
              dashboard.pendingLeaveApprovals.map((leave: {
                employeeNumber: string
                fullName: string
                leaveTypeName: string
                startDate: string
                endDate: string
                totalDays: number
              }) => (
                <div
                  key={`${leave.employeeNumber}-${leave.startDate}-${leave.endDate}`}
                  className="rounded-md border p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{leave.fullName}</p>
                      <p className="text-xs text-muted-foreground">{leave.employeeNumber}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {leave.totalDays} day(s)
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {leave.leaveTypeName} · {leave.startDate} to {leave.endDate}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No pending leave requests right now.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Attendance Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard?.attendanceSummary.length ? (
              dashboard.attendanceSummary.map((row: {
                employeeNumber: string
                fullName: string
                attendanceDays: number
                overtimeHours: number
              }) => (
                <div key={row.employeeNumber} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{row.fullName}</p>
                      <p className="text-xs text-muted-foreground">{row.employeeNumber}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {row.attendanceDays} day(s)
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Overtime: {row.overtimeHours.toFixed(2)} hours
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No attendance data for this month yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Published Policies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard?.publishedPolicies.length ? (
              dashboard.publishedPolicies.map((policy: {
                title: string
                category: string
                version: string
                effectiveDate: string
              }) => (
                <div key={`${policy.title}-${policy.version}`} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{policy.title}</p>
                    <span className="text-xs text-muted-foreground">v{policy.version}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {policy.category} · Effective {policy.effectiveDate}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No published policies yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
