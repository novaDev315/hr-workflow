import { gql, useQuery } from "@apollo/client";
import { Calendar, CheckCircle2, FileText, Users } from "lucide-react";
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
  recentHires: Array<{
    employeeNumber: string;
    fullName: string;
    joinDate: string;
    departmentName: string;
    designationTitle: string;
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
      recentHires {
        employeeNumber
        fullName
        joinDate
        departmentName
        designationTitle
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

  const greetingName =
    account?.firstName || account?.fullName?.split(" ")[0] || "there";

  const actionItems = [
    ...pendingLeaveApprovals.slice(0, 2).map((leave) => ({
      id: `${leave.employeeNumber}-${leave.startDate}`,
      title: `${leave.fullName} requested ${leave.leaveTypeName}`,
      detail: `${formatDate(leave.startDate)} · ${leave.totalDays} day${leave.totalDays === 1 ? "" : "s"}`,
      tone: "warning" as const,
      to: "/leave",
    })),
    ...recentHires.slice(0, 1).map((hire) => ({
      id: `${hire.employeeNumber}-${hire.joinDate}`,
      title: `${hire.fullName} joined ${hire.departmentName}`,
      detail: `${hire.designationTitle} · ${formatDate(hire.joinDate)}`,
      tone: "info" as const,
      to: "/employees",
    })),
    ...publishedPolicies.slice(0, 1).map((policy) => ({
      id: `${policy.title}-${policy.version}`,
      title: `${policy.title} published`,
      detail: `${policy.category} · v${policy.version}`,
      tone: "success" as const,
      to: "/policies",
    })),
  ].slice(0, 4);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="app-surface h-[140px] animate-pulse" />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div className="app-surface h-[180px] animate-pulse" />
            <div className="app-surface h-[160px] animate-pulse" />
          </div>
          <div className="space-y-4">
            <div className="app-surface h-[220px] animate-pulse" />
            <div className="app-surface h-[120px] animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Notice tone="warning">
          Dashboard data is unavailable right now. {error.message}
        </Notice>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card className="app-hero-surface">
            <CardContent className="space-y-5 p-6">
              <div className="space-y-2">
                <p className="app-kicker">Today&apos;s home</p>
                <h2 className="app-section-title text-3xl sm:text-[3.25rem]">
                  Good day, {greetingName}.
                </h2>
                <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                  Keep today focused on approvals, people updates, and the work that needs the calmest attention first.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Link
                  className="app-action-tile"
                  to="/leave"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                      <CheckCircle2 className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Review Leave</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Pending requests and approvals.
                      </p>
                    </div>
                  </div>
                </Link>

                <Link
                  className="app-action-tile"
                  to="/employees"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                      <Users className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Employees</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Records, access, and updates.
                      </p>
                    </div>
                  </div>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <p className="app-kicker">Review queue</p>
              <CardTitle>Leave requests</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingLeaveApprovals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No pending leave requests.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {pendingLeaveApprovals.slice(0, 4).map((leave) => (
                    <div
                      key={`${leave.employeeNumber}-${leave.startDate}`}
                      className="app-muted-surface flex items-center justify-between gap-4 px-4 py-3"
                    >
                      <div>
                        <p className="font-semibold text-foreground">
                          {leave.fullName}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {leave.leaveTypeName} · {formatDate(leave.startDate)}
                        </p>
                      </div>
                      <StatusBadge tone="warning">
                        {leave.totalDays} day{leave.totalDays === 1 ? "" : "s"}
                      </StatusBadge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {actionItems.length > 0 ? (
            <Card>
              <CardHeader>
                <p className="app-kicker">Next</p>
                <CardTitle>Open items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {actionItems.map((item) => (
                  <Link
                    key={item.id}
                    className="app-muted-surface flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-[rgba(255,255,255,0.78)]"
                    to={item.to}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">
                        {item.title}
                      </p>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {item.detail}
                      </p>
                    </div>
                    <StatusBadge tone={item.tone}>Open</StatusBadge>
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <p className="app-kicker">This month</p>
              <CardTitle>Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
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
                detail={`${overview?.publishedPolicies ?? 0} published policies`}
                icon={FileText}
                label="Net payroll"
                tone="bg-rose-100 text-rose-800"
                value={formatCurrency(overview?.monthlyPayrollNetPay ?? 0)}
              />
            </CardContent>
          </Card>

          {publishedPolicies.length > 0 ? (
            <Card>
              <CardHeader>
                <p className="app-kicker">Latest policy</p>
                <CardTitle>{publishedPolicies[0].title}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {publishedPolicies[0].category} ·{" "}
                  {formatDate(publishedPolicies[0].effectiveDate)}
                </p>
                <StatusBadge tone="neutral">
                  v{publishedPolicies[0].version}
                </StatusBadge>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
