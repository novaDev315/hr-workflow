import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: string;
  value: string;
  /** One short caption that describes the value itself. */
  detail?: string;
  icon?: LucideIcon;
  /** Kept for compatibility; metric cards no longer use colored icon tiles. */
  tone?: string;
  className?: string;
};

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  className,
}: MetricCardProps) {
  return (
    <Card
      className={cn(
        "app-muted-surface flex h-full min-w-0 flex-col gap-0.5 px-3 py-2.5 shadow-none sm:gap-1 sm:px-4 sm:py-3.5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 min-w-0 text-[13px] font-medium leading-5 text-muted-foreground sm:text-sm">{label}</p>
        {Icon ? (
          <Icon aria-hidden="true" className="mt-0.5 hidden h-4 w-4 shrink-0 text-muted-foreground/70 sm:block" />
        ) : null}
      </div>
      <p className="break-words text-[1.25rem] font-semibold leading-tight tracking-[-0.03em] text-foreground tabular-nums sm:text-[1.6rem]">
        {value}
      </p>
      {detail ? (
        <p className="mt-auto line-clamp-2 text-[13px] leading-5 text-muted-foreground max-sm:hidden" title={detail}>
          {detail}
        </p>
      ) : null}
    </Card>
  );
}
