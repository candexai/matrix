"use client";
import { useState, type ReactNode } from "react";
import { ChevronRight, RefreshCw, TriangleAlert, type LucideIcon } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { TagInput } from "./primitives";

/* Shared chrome for the workspace-resource pickers (HTTP tools, knowledge base). */

export function PanelList({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

export function PanelRow({
  id,
  checked,
  onCheckedChange,
  leading,
  title,
  description,
  meta,
  actions,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  leading?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={cn("group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40", checked && "bg-accent-tint/20")}>
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onCheckedChange(v === true)} className="mt-[3px]" />
      {leading ? <div className="mt-0.5 shrink-0 text-muted-foreground">{leading}</div> : null}
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] font-medium leading-5">{title}</div>
        {description ? <p className="line-clamp-1 text-xs text-muted-foreground">{description}</p> : null}
        {meta ? <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-muted-foreground">{meta}</div> : null}
      </label>
      {actions ? <div className="flex shrink-0 items-center gap-0.5">{actions}</div> : null}
    </div>
  );
}

export function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3">
            <Skeleton className="mt-1 size-4 rounded-[4px]" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PanelError({ error, onRetry, retrying }: { error: unknown; onRetry: () => void; retrying?: boolean }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-[13px]">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
      <span className="min-w-0 flex-1">{errorMessage(error)}</span>
      <Button type="button" variant="outline" size="xs" onClick={onRetry} loading={retrying}>
        {!retrying ? <RefreshCw /> : null} Retry
      </Button>
    </div>
  );
}

export function PanelEmpty({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-6 text-center">
      <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" strokeWidth={1.8} />
      </div>
      <div className="text-[13px] font-medium">{title}</div>
      {description ? <p className="max-w-md text-xs text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

/** "Advanced: paste IDs" collapsible — the raw tag input for resources created elsewhere. */
export function AdvancedIds({ label, value, onChange, placeholder, help, unknownCount }: { label: string; value: string[]; onChange: (v: string[]) => void; placeholder: string; help: ReactNode; unknownCount?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
        <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
        Advanced: paste {label}
        {unknownCount ? <span className="ml-1 rounded-full bg-muted px-1.5 text-[11px] tabular-nums">{unknownCount} not in the list</span> : null}
      </button>
      {open ? (
        <div className="mt-2 flex flex-col gap-1.5">
          <TagInput value={value} onChange={onChange} placeholder={placeholder} mono ariaLabel={label} />
          <p className="text-xs text-muted-foreground">{help}</p>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- formatting helpers ---------- */

export function formatBytes(n?: number | null): string | null {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDate(d?: string | null): string | null {
  if (!d) return null;
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return null;
  return t.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
