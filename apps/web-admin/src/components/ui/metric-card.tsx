import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

type MetricCardProps = {
  label: string;
  value: string;
  detail?: string;
  icon?: LucideIcon;
  tone?: string;
};

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "bg-accent text-accent-foreground",
}: MetricCardProps) {
  return (
    <Card className="app-muted-surface border-l-[3px] border-l-primary/45 shadow-none">
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-1.5 text-[1.65rem] font-semibold tracking-[-0.035em] text-foreground">
            {value}
          </p>
          {detail ? (
            <p className="mt-1.5 text-sm text-muted-foreground">{detail}</p>
          ) : null}
        </div>
        {Icon ? (
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}
          >
            <Icon className="h-4.5 w-4.5" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
