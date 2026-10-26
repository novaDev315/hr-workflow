import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

type AdminTableProps = {
  children: ReactNode;
  className?: string;
  /** "compact" tightens row padding for dense registers. */
  density?: "comfortable" | "compact";
  /** Accessible caption (visually hidden). */
  caption?: string;
  tableClassName?: string;
};

/**
 * Scrolls horizontally instead of clipping. Columns keep their natural
 * width (no 3-line names or split dates); a soft edge shadow shows when
 * more columns are off-screen.
 */
export function AdminTable({
  children,
  className,
  density = "comfortable",
  caption,
  tableClassName,
}: AdminTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const maxScroll = element.scrollWidth - element.clientWidth;
    const next = {
      left: element.scrollLeft > 1,
      right: maxScroll - element.scrollLeft > 1,
    };
    setEdges((current) =>
      current.left === next.left && current.right === next.right ? current : next,
    );
  }, []);

  useEffect(() => {
    measure();
    const element = scrollRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <div
      className={cn(
        "admin-table-frame relative overflow-hidden rounded-[calc(var(--radius)-0.1rem)] border border-border/70 bg-card",
        className,
      )}
      data-scroll-left={edges.left || undefined}
      data-scroll-right={edges.right || undefined}
    >
      <div
        ref={scrollRef}
        className="overflow-x-auto overscroll-x-contain"
        onScroll={measure}
        tabIndex={edges.left || edges.right ? 0 : undefined}
        role={edges.left || edges.right ? "region" : undefined}
        aria-label={edges.left || edges.right ? caption ?? "Scrollable table" : undefined}
      >
        <table
          className={cn("admin-table w-max min-w-full", tableClassName)}
          data-density={density}
        >
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          {children}
        </table>
      </div>
      <span aria-hidden="true" className="admin-table-shadow admin-table-shadow-left" />
      <span aria-hidden="true" className="admin-table-shadow admin-table-shadow-right" />
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
        "border-b border-border/70 bg-card align-middle transition-colors last:border-b-0 hover:bg-secondary/55",
        className,
      )}
      {...props}
    />
  );
}

type CellAlign = {
  /** Right-aligned, tabular numbers, never wraps. */
  numeric?: boolean;
  /** Keep on one line (dates, badges, codes). */
  nowrap?: boolean;
};

export function AdminTableHead({
  className,
  numeric,
  nowrap = true,
  ...props
}: ComponentPropsWithoutRef<"th"> & CellAlign) {
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-3",
        numeric ? "text-right" : "text-left",
        nowrap && "whitespace-nowrap",
        className,
      )}
      {...props}
    />
  );
}

export function AdminTableCell({
  className,
  numeric,
  nowrap,
  ...props
}: ComponentPropsWithoutRef<"td"> & CellAlign) {
  return (
    <td
      className={cn(
        "px-4 py-3",
        numeric && "text-right tabular-nums whitespace-nowrap",
        nowrap && "whitespace-nowrap",
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
