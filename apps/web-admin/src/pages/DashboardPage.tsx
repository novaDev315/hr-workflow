import { gql, useQuery } from "@apollo/client";
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock3,
  FileText,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAdminSession } from "@/lib/auth-session";
import { formatCurrency, formatDate } from "@/lib/utils";

type DashboardSummary = {
  accessScopeLabel: string;
  overview: {
    activeEmployees: number;
    pendingLeaveRequests: number;
    processedPayrollPeriods: number;
    publishedPolicies: number;
    monthlyPayrollNetPay: number;
  };
  departmentHeadcount: Array<{
    departmentName: string;
    employeeCount: number;
  }>;
  recentHires: Array<{
    employeeNumber: string;
    fullName: string;
    joinDate: string;
    departmentName: string;
    designationTitle: string;
  }>;
  attendanceSummary: Array<{
    employeeNumber: string;
    fullName: string;
    attendanceDays: number;
    overtimeHours: number;
  }>;
  payrollDepartmentCosts: Array<{
    departmentName: string;
    payslipCount: number;
    totalNetPay: number;
  }>;
  pendingLeaveApprovals: Array<{
    employeeNumber: string;
    fullName: string;
    leaveTypeName: string;
    startDate: string;
    endDate: string;
    totalDays: number;
  }>;
  publishedPolicies: Array<{
    title: string;
    category: string;
    version: string;
    effectiveDate: string;
  }>;
};

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
`;

export function DashboardPage() {
  const { account } = useAdminSession();
  const periodMonth = new Date().toISOString().slice(0, 7);
  const { data, loading, error } = useQuery(DASHBOARD_QUERY, {
    variables: { periodMonth },
  });

  const dashboard: DashboardSummary | null = data?.reportsDashboard ?? null;
  const overview = dashboard?.overview;
  const pendingLeaveApprovals = dashboard?.pendingLeaveApprovals ?? [];
  const recentHires = dashboard?.recentHires ?? [];
  const publishedPolicies = dashboard?.publishedPolicies ?? [];
  const departmentHeadcount = dashboard?.departmentHeadcount ?? [];
  const payrollDepartmentCosts = dashboard?.payrollDepartmentCosts ?? [];
  const attendanceSummary = dashboard?.attendanceSummary ?? [];

  const greetingName =
    account?.firstName || account?.fullName?.split(" ")[0] || "there";

  const actionItems = [
    ...pendingLeaveApprovals.slice(0, 2).map((leave) => ({
      id: `${leave.employeeNumber}-${leave.startDate}`,
      title: `${leave.fullName} requested ${leave.leaveTypeName}`,
      detail: `${formatDate(leave.startDate)} to ${formatDate(leave.endDate)} · ${leave.totalDays} day(s)`,
      tone: "warning" as const,
      icon: Calendar,
      to: "/leave",
    })),
    ...recentHires.slice(0, 1).map((hire) => ({
      id: `${hire.employeeNumber}-${hire.joinDate}`,
      title: `${hire.fullName} joined ${hire.departmentName}`,
      detail: `${hire.designationTitle} · ${formatDate(hire.joinDate)}`,
      tone: "info" as const,
      icon: Users,
      to: "/employees",
    })),
    ...publishedPolicies.slice(0, 1).map((policy) => ({
      id: `${policy.title}-${policy.version}`,
      title: `${policy.title} is published`,
      detail: `${policy.category} · v${policy.version}`,
      tone: "success" as const,
      icon: FileText,
      to: "/policies",
    })),
  ].slice(0, 4);

  const highestDepartmentHeadcount = Math.max(
    ...departmentHeadcount.map((item) => item.employeeCount),
    1,
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="app-surface h-[110px] animate-pulse" />
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="app-surface h-[160px] animate-pulse" />
            <div className="app-surface h-[120px] animate-pulse" />
            <div className="app-surface h-[260px] animate-pulse" />
          </div>
          <div className="space-y-4">
            <div className="app-surface h-[260px] animate-pulse" />
            <div className="app-surface h-[260px] animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Notice tone="warning">
          Dashboard data is unavailable right now. Live sections below will stay
          empty until the backend responds again. {error.message}
        </Notice>
      ) : null}

      {pendingLeaveApprovals.length > 0 ? (
        <Notice tone="info">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Leave requests need review.</p>
              <p className="mt-1">
                {pendingLeaveApprovals[0].fullName} has a pending{" "}
                {pendingLeaveApprovals[0].leaveTypeName.toLowerCase()} request.
              </p>
            </div>
            <Link
              className="text-sm font-semibold text-primary hover:underline"
              to="/leave"
            >
              See details
            </Link>
          </div>
        </Notice>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-5 p-6">
              <div>
                <p className="app-kicker">Overview</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-foreground">
                  Good day, {greetingName}.
                </h2>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Link
                  className="rounded-[1.2rem] border border-border/70 bg-secondary/60 px-4 py-4 transition-colors hover:bg-white"
                  to="/leave"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        Review Leave
                      </p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        Clear requests and keep leave approvals moving.
                      </p>
                    </div>
                  </div>
                </Link>

                <Link
                  className="rounded-[1.2rem] border border-border/70 bg-secondary/60 px-4 py-4 transition-colors hover:bg-white"
                  to="/employees"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        Add New Employees
                      </p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        Open employee setup when a team or account change is
                        needed.
                      </p>
                    </div>
                  </div>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <p className="app-kicker">Upcoming leaves</p>
              <CardTitle>Visible requests</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingLeaveApprovals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No pending leave requests are scheduled right now.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {pendingLeaveApprovals.slice(0, 6).map((leave) => (
                    <div
                      key={`${leave.employeeNumber}-${leave.startDate}`}
                      className="rounded-[1.1rem] border border-border/70 bg-secondary/55 p-4"
                    >
                      <p className="font-semibold text-foreground">
                        {leave.fullName}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {leave.leaveTypeName}
                      </p>
                      <p className="mt-3 text-sm text-muted-foreground">
                        {formatDate(leave.startDate)} to{" "}
                        {formatDate(leave.endDate)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <p className="app-kicker">Actions to do</p>
              <CardTitle>What needs attention</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {actionItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No urgent actions are surfaced right now.
                </p>
              ) : (
                actionItems.map((item) => (
                  <Link
                    key={item.id}
                    className="flex items-start justify-between gap-4 rounded-[1.1rem] border border-border/70 bg-white px-4 py-4 transition-colors hover:bg-secondary/55"
                    to={item.to}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-foreground">
                        <item.icon className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">
                          {item.title}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {item.detail}
                        </p>
                      </div>
                    </div>
                    <StatusBadge tone={item.tone}>Open</StatusBadge>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <p className="app-kicker">This month</p>
              <CardTitle>Current snapshot</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <MetricCard
                detail={dashboard?.accessScopeLabel ?? "No scope available"}
                icon={Users}
                label="Active employees"
                tone="bg-emerald-100 text-emerald-800"
                value={String(overview?.activeEmployees ?? 0)}
              />
              <MetricCard
                detail="Waiting review"
                icon={Calendar}
                label="Pending leave"
                tone="bg-amber-100 text-amber-800"
                value={String(overview?.pendingLeaveRequests ?? 0)}
              />
              <MetricCard
                detail="Processed periods"
                icon={Clock3}
                label="Payroll cycles"
                tone="bg-sky-100 text-sky-800"
                value={String(overview?.processedPayrollPeriods ?? 0)}
              />
              <MetricCard
                detail={`${overview?.publishedPolicies ?? 0} published policies`}
                icon={Briefcase}
                label="Net payroll"
                tone="bg-rose-100 text-rose-800"
                value={formatCurrency(overview?.monthlyPayrollNetPay ?? 0)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <p className="app-kicker">Teams</p>
              <CardTitle>Headcount by department</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {departmentHeadcount.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No department data is available yet.
                </p>
              ) : (
                departmentHeadcount.map((department) => (
                  <div
                    key={department.departmentName}
                    className="rounded-[1.1rem] border border-border/70 bg-secondary/55 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">
                          {department.departmentName}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {department.employeeCount} employees
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-foreground">
                        {department.employeeCount}
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${(department.employeeCount / highestDepartmentHeadcount) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <p className="app-kicker">Attendance, payroll, and policy</p>
              <CardTitle>Supporting context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {attendanceSummary.length > 0 ? (
                <div className="space-y-3">
                  {attendanceSummary.slice(0, 3).map((employee) => (
                    <div
                      key={employee.employeeNumber}
                      className="rounded-[1.1rem] border border-border/70 bg-secondary/55 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">
                            {employee.fullName}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {employee.employeeNumber}
                          </p>
                        </div>
                        <StatusBadge tone="accent">
                          {employee.attendanceDays} days
                        </StatusBadge>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">
                        Overtime: {employee.overtimeHours.toFixed(2)} hours
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}

              {payrollDepartmentCosts.length > 0 ? (
                <div
                  className={
                    attendanceSummary.length > 0
                      ? "space-y-3 border-t border-border/70 pt-4"
                      : "space-y-3"
                  }
                >
                  {payrollDepartmentCosts.slice(0, 3).map((department) => (
                    <div
                      key={department.departmentName}
                      className="rounded-[1.1rem] border border-border/70 bg-secondary/55 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">
                            {department.departmentName}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {department.payslipCount} payslips
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-foreground">
                          {formatCurrency(department.totalNetPay)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {publishedPolicies.length > 0 ? (
                <div
                  className={
                    attendanceSummary.length > 0 ||
                    payrollDepartmentCosts.length > 0
                      ? "space-y-3 border-t border-border/70 pt-4"
                      : "space-y-3"
                  }
                >
                  {publishedPolicies.slice(0, 2).map((policy) => (
                    <div
                      key={`${policy.title}-${policy.version}`}
                      className="rounded-[1.1rem] border border-border/70 bg-white px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">
                            {policy.title}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {policy.category} ·{" "}
                            {formatDate(policy.effectiveDate)}
                          </p>
                        </div>
                        <StatusBadge tone="neutral">
                          v{policy.version}
                        </StatusBadge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {attendanceSummary.length === 0 &&
              payrollDepartmentCosts.length === 0 &&
              publishedPolicies.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Supporting operational details will appear here when live data
                  is available.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
