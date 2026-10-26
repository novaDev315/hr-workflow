import { Sprout } from "lucide-react";

import { cn } from "@/lib/utils";

// The single HRFlow Pro mark: sidebar, sign-in and favicon (public/favicon.svg) all use it.
export function BrandMark({ className, iconClassName }: { className?: string; iconClassName?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm",
        className,
      )}
    >
      <Sprout className={cn("h-4 w-4", iconClassName)} />
    </div>
  );
}
