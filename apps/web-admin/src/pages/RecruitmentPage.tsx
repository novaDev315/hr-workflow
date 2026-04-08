import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { Calendar, CheckCircle2, FileText, Plus, Users } from "lucide-react";

type RecruitmentMetric = {
  title: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone: string;
};

type RecentApplication = {
  id: string;
  candidateName: string;
  position: string;
  appliedDate: string;
  status: string;
  experience: string;
};

const recruitmentMetrics: RecruitmentMetric[] = [
  {
    title: "Active Openings",
    value: "15",
    detail: "4 roles posted this week",
    icon: FileText,
    tone: "bg-sky-100 text-sky-700",
  },
  {
    title: "Total Applications",
    value: "342",
    detail: "28 new submissions today",
    icon: Users,
    tone: "bg-emerald-100 text-emerald-700",
  },
  {
    title: "Interviews Scheduled",
    value: "23",
    detail: "7 scheduled in the next 3 days",
    icon: Calendar,
    tone: "bg-amber-100 text-amber-700",
  },
  {
    title: "Offers Sent",
    value: "8",
    detail: "3 awaiting acceptance",
    icon: CheckCircle2,
    tone: "bg-violet-100 text-violet-700",
  },
];

const recentApplications: RecentApplication[] = [
  {
    id: "1",
    candidateName: "Ankit Verma",
    position: "Senior Developer",
    appliedDate: "2024-11-15",
    status: "Shortlisted",
    experience: "5 years",
  },
  {
    id: "2",
    candidateName: "Neha Singh",
    position: "HR Executive",
    appliedDate: "2024-11-14",
    status: "Interview Scheduled",
    experience: "3 years",
  },
  {
    id: "3",
    candidateName: "Rajesh Gupta",
    position: "Sales Manager",
    appliedDate: "2024-11-13",
    status: "Screening",
    experience: "8 years",
  },
];

function getApplicationStatusTone(status: string) {
  switch (status) {
    case "Shortlisted":
      return "success" as const;
    case "Interview Scheduled":
      return "info" as const;
    default:
      return "warning" as const;
  }
}

export function RecruitmentPage() {
  return (
    <div className="space-y-4">
      <Notice tone="info">
        Live recruitment records are still being connected. Sample pipeline data
        remains visible so hiring workflows and entry points stay available.
      </Notice>

      <Card>
        <CardContent className="flex flex-col gap-5 p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="app-kicker">Recruitment</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-foreground">
              Manage the hiring pipeline.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Review recruiting momentum, keep recent candidates visible, and
              leave the new opening workflow accessible until live records
              arrive.
            </p>
          </div>

          <Button className="gap-2 self-start lg:self-auto" type="button">
            <Plus className="h-4 w-4" />
            New Job Opening
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {recruitmentMetrics.map((metric) => (
          <MetricCard
            key={metric.title}
            detail={metric.detail}
            icon={metric.icon}
            label={metric.title}
            tone={metric.tone}
            value={metric.value}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <p className="app-kicker">Candidates</p>
          <CardTitle>Recent Applications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 md:hidden">
            {recentApplications.map((application) => (
              <div key={application.id} className="app-muted-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">
                      {application.candidateName}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {application.position}
                    </p>
                  </div>
                  <StatusBadge
                    tone={getApplicationStatusTone(application.status)}
                  >
                    {application.status}
                  </StatusBadge>
                </div>
                <div className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                  <p>Experience: {application.experience}</p>
                  <p>Applied: {application.appliedDate}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left">Candidate</th>
                  <th className="px-4 py-3 text-left">Position</th>
                  <th className="px-4 py-3 text-left">Experience</th>
                  <th className="px-4 py-3 text-left">Applied Date</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentApplications.map((application) => (
                  <tr
                    key={application.id}
                    className="border-b hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 font-medium">
                      {application.candidateName}
                    </td>
                    <td className="px-4 py-3">{application.position}</td>
                    <td className="px-4 py-3">{application.experience}</td>
                    <td className="px-4 py-3">{application.appliedDate}</td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        tone={getApplicationStatusTone(application.status)}
                      >
                        {application.status}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
