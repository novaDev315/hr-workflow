import { useQuery } from '@apollo/client'
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  Circle,
  FileText,
  Settings2,
  UserPlus,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MetricCard } from '@/components/ui/metric-card'
import { Notice } from '@/components/ui/notice'
import { useCanViewPayroll } from '@/features/reports/use-can-view-payroll'
import { useAdminSession } from '@/lib/auth-session'
import {
  currentMonthLocal,
  formatDay,
  formatDayRange,
  formatMoney,
  formatMonth,
  plural,
  todayLocal,
} from '@/lib/format'
import { readableError } from '@/lib/graphql-errors'
import { cn } from '@/lib/utils'

import {
  DASHBOARD_PAYROLL_QUERY,
  DASHBOARD_QUERY,
  DASHBOARD_SETUP_QUERY,
  type DashboardPayrollPeriod,
  type DashboardSetup,
  type DashboardSummary,
} from './graphql'

type AttentionItem = {
  id: string
  icon: LucideIcon
  title: string
  detail: string
  to: string
  actionLabel: string
}

type ActivityItem = {
  id: string
  icon: LucideIcon
  title: string
  detail: string
  date: string
}

const MAX_LEAVE_ITEMS = 4

export function DashboardPage() {
  const { account } = useAdminSession()
  const periodMonth = currentMonthLocal()
  const today = todayLocal()
  const { canViewPayroll } = useCanViewPayroll(periodMonth)

  const { data, loading, error } = useQuery<{ reportsDashboard: DashboardSummary }>(
    DASHBOARD_QUERY,
    { variables: { periodMonth } },
  )
  const { data: setupData, loading: setupLoading } = useQuery<DashboardSetup>(
    DASHBOARD_SETUP_QUERY,
    { errorPolicy: 'all' },
  )
  const { data: payrollData } = useQuery<{ payrollPeriods: DashboardPayrollPeriod[] }>(
    DASHBOARD_PAYROLL_QUERY,
    { skip: !canViewPayroll, errorPolicy: 'all' },
  )

  const dashboard = data?.reportsDashboard ?? null
  const overview = dashboard?.overview
  const pendingLeave = dashboard?.pendingLeaveApprovals ?? []
  const recentHires = dashboard?.recentHires ?? []
  const publishedPolicies = dashboard?.publishedPolicies ?? []
  const payrollPeriods = payrollData?.payrollPeriods ?? []

  const greetingName = account?.firstName || account?.fullName?.split(' ')[0] || 'there'

  const hasCompanySettings = Boolean(setupData?.companySettings)
  const departmentCount = setupData?.departments?.length ?? 0
  const designationCount = setupData?.designations?.length ?? 0
  const activeEmployees = overview?.activeEmployees ?? 0
  const setupKnown = Boolean(setupData) && !setupLoading
  const isFreshInstall = Boolean(dashboard) && activeEmployees === 0

  const attention: AttentionItem[] = []

  for (const leave of pendingLeave.slice(0, MAX_LEAVE_ITEMS)) {
    attention.push({
      id: `leave-${leave.employeeNumber}-${leave.startDate}`,
      icon: CalendarClock,
      title: `${leave.fullName} · ${leave.leaveTypeName}`,
      detail: `${formatDayRange(leave.startDate, leave.endDate)} · ${plural(leave.totalDays, 'day')}`,
      to: '/leave',
      actionLabel: 'Review',
    })
  }

  if (canViewPayroll) {
    const sortedPeriods = [...payrollPeriods].sort((a, b) =>
      b.periodMonth.localeCompare(a.periodMonth),
    )
    for (const period of sortedPeriods) {
      if (period.status === 'OPEN') {
        attention.push({
          id: `payroll-${period.id}`,
          icon: Wallet,
          title: `${formatMonth(period.periodMonth)} payroll is ready to process`,
          detail: 'Check compensation, then process payroll.',
          to: '/payroll',
          actionLabel: 'Open payroll',
        })
      } else if (period.status === 'PROCESSED') {
        attention.push({
          id: `payroll-${period.id}`,
          icon: Wallet,
          title: `${formatMonth(period.periodMonth)} payroll is awaiting payment`,
          detail: `${plural(period.payslipCount, 'payslip')} generated. Mark as paid once salaries are sent.`,
          to: '/payroll',
          actionLabel: 'Open payroll',
        })
      }
    }
  }

  if (setupKnown && !isFreshInstall) {
    if (!hasCompanySettings) {
      attention.push({
        id: 'setup-company',
        icon: Settings2,
        title: 'No company settings yet',
        detail: 'Add the company name, currency and time zone.',
        to: '/organisation',
        actionLabel: 'Set up',
      })
    }
    if (departmentCount === 0 || designationCount === 0) {
      attention.push({
        id: 'setup-structure',
        icon: Building2,
        title: departmentCount === 0 ? 'No departments yet' : 'No designations yet',
        detail: 'Departments and designations keep reports and approvals accurate.',
        to: '/organisation',
        actionLabel: 'Set up',
      })
    }
  }

  const recentActivity: ActivityItem[] = [
    ...recentHires.map((hire) => ({
      id: `hire-${hire.employeeNumber}`,
      icon: UserPlus,
      title: `${hire.fullName} joined ${hire.departmentName}`,
      detail: hire.designationTitle,
      date: hire.joinDate,
    })),
    ...publishedPolicies.map((policy) => ({
      id: `policy-${policy.title}-${policy.version}`,
      icon: FileText,
      title: `${policy.title} is in effect`,
      detail: `${policy.category} · version ${policy.version}`,
      date: policy.effectiveDate,
    })),
  ]
    .filter((item) => item.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)

  if (loading && !dashboard) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="app-surface h-[120px] animate-pulse" />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="app-surface h-[220px] animate-pulse" />
          <div className="app-surface h-[220px] animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-4">
      <section className="app-hero-surface min-w-0 px-5 py-5 sm:px-6 sm:py-6">
        <p className="app-kicker leading-4">{formatDay(today)}</p>
        <h1 className="app-greeting mt-3 break-words">Good day, {greetingName}.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {attention.length > 0
            ? `${plural(attention.length, 'item')} ${attention.length === 1 ? 'needs' : 'need'} your attention today.`
            : 'Nothing needs your attention right now.'}
        </p>
      </section>

      {error ? (
        <Notice tone="warning" role="alert">
          Home data is unavailable right now. {readableError(error)}
        </Notice>
      ) : null}

      {isFreshInstall ? (
        <SetupChecklist
          hasCompanySettings={hasCompanySettings}
          hasStructure={departmentCount > 0 && designationCount > 0}
          hasEmployees={activeEmployees > 0}
        />
      ) : null}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <Card className="min-w-0">
            <CardHeader className="pb-3">
              <CardTitle>Needs your attention</CardTitle>
            </CardHeader>
            <CardContent>
              {attention.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  You are all caught up. New leave requests and payroll steps will appear here.
                </p>
              ) : (
                <ul className="divide-y divide-border/70">
                  {attention.map((item) => (
                    <li key={item.id}>
                      <Link
                        to={item.to}
                        className="group -mx-2 flex min-w-0 items-start gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <item.icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-semibold text-foreground sm:line-clamp-1">{item.title}</p>
                          <p className="line-clamp-2 text-[13px] text-muted-foreground sm:line-clamp-1">{item.detail}</p>
                        </div>
                        <span className="hidden shrink-0 items-center gap-1 self-center text-[13px] font-semibold text-primary sm:inline-flex">
                          {item.actionLabel}
                          <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </span>
                        <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 self-center text-primary sm:hidden" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {pendingLeave.length > MAX_LEAVE_ITEMS ? (
                <Link to="/leave" className="mt-2 inline-block text-[13px] font-semibold text-primary hover:underline">
                  See all {plural(pendingLeave.length, 'pending request')}
                </Link>
              ) : null}
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader className="pb-3">
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  New hires and published policies will show up here.
                </p>
              ) : (
                <ul className="divide-y divide-border/70">
                  {recentActivity.map((item) => (
                    <li key={item.id} className="flex min-w-0 items-center gap-3 py-3">
                      <item.icon aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                        <p className="truncate text-[13px] text-muted-foreground">{item.detail}</p>
                      </div>
                      <span className="shrink-0 whitespace-nowrap text-[13px] text-muted-foreground tabular-nums">
                        {formatDay(item.date)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="min-w-0 space-y-3" aria-label="This month">
          <h2 className="app-kicker px-1">{formatMonth(periodMonth)}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <MetricCard
              label="Active employees"
              value={String(activeEmployees)}
              detail={dashboard?.accessScopeLabel ?? 'Currently active'}
            />
            <MetricCard
              label="Pending leave"
              value={String(overview?.pendingLeaveRequests ?? 0)}
              detail={
                (overview?.pendingLeaveRequests ?? 0) === 0
                  ? 'No requests waiting'
                  : 'Waiting for review'
              }
            />
            {canViewPayroll ? (
              <MetricCard
                label="Net payroll"
                value={formatMoney(overview?.monthlyPayrollNetPay ?? 0)}
                detail={
                  (overview?.monthlyPayrollNetPay ?? 0) > 0
                    ? `Net pay for ${formatMonth(periodMonth)}`
                    : `Not processed for ${formatMonth(periodMonth)}`
                }
              />
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  )
}

function SetupChecklist({
  hasCompanySettings,
  hasStructure,
  hasEmployees,
}: {
  hasCompanySettings: boolean
  hasStructure: boolean
  hasEmployees: boolean
}) {
  const steps = [
    {
      done: hasCompanySettings,
      title: 'Add company settings',
      detail: 'Company name, currency and time zone.',
      to: '/organisation',
    },
    {
      done: hasStructure,
      title: 'Create departments and designations',
      detail: 'The structure people, approvals and reports use.',
      to: '/organisation',
    },
    {
      done: hasEmployees,
      title: 'Add your first employee',
      detail: 'Then set their compensation and login.',
      to: '/employees',
    },
  ]
  const completed = steps.filter((step) => step.done).length

  return (
    <Card className="min-w-0">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <CardTitle>Set up your workspace</CardTitle>
          <span className="text-[13px] text-muted-foreground">
            {completed} of {steps.length} done
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-2 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="min-w-0">
              <Link
                to={step.to}
                className={cn(
                  'app-muted-surface flex h-full min-w-0 items-start gap-3 p-3.5 transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  step.done && 'opacity-70',
                )}
              >
                {step.done ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                ) : (
                  <Circle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    <span className="sr-only">{step.done ? 'Done: ' : `Step ${index + 1}: `}</span>
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">{step.detail}</p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
