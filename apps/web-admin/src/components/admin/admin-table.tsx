import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

type AdminTableProps = {
  children: ReactNode;
  className?: string;
};

export function AdminTable({ children, className }: AdminTableProps) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-[calc(var(--radius)-0.1rem)] border border-border/70",
        className,
      )}
    >
      <table className="w-full">{children}</table>
    </div>
  );
}

export function AdminTableRow({
  className,
  ...props
}: ComponentPropsWithoutRef<"tr">) {
  return (
    <tr
      className={cn(
        "border-b border-border/70 bg-card align-top transition-colors last:border-b-0 hover:bg-secondary/55",
        className,
      )}
      {...props}
    />
  );
}

export function AdminTableEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="app-muted-surface p-4 text-sm text-muted-foreground">
      {children}
    </div>
  );
}
