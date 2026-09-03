"use client";
import type { TooltipContentProps } from "recharts";
import { formatNumber } from "@/lib/utils";

export const COLORS = {
  c1: "var(--chart-1)",
  c2: "var(--chart-2)",
  c3: "var(--chart-3)",
  c4: "var(--chart-4)",
  c5: "var(--chart-5)",
  c6: "var(--chart-6)",
  success: "var(--success)",
  destructive: "var(--destructive)",
  muted: "var(--muted-foreground)",
  surface: "var(--card)",
  grid: "var(--border)",
} as const;

export const TICK = { fontSize: 11, fill: "var(--muted-foreground)" } as const;
/** Recessive axis: no axis line, no tick marks, small muted labels. */
export const AXIS = { axisLine: false, tickLine: false, tick: TICK } as const;
export const GRID = { vertical: false, stroke: COLORS.grid, strokeWidth: 1 } as const;
export const BAR_CURSOR = { fill: "var(--muted)", fillOpacity: 0.7 } as const;
export const LINE_CURSOR = { stroke: "var(--border)", strokeWidth: 1 } as const;

export function fmtDay(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
export const fmtMinutes = (v: number) => `${Math.round(v * 10) / 10} min`;
export const fmtPct = (v: number) => `${Math.round(v)}%`;

type Entry = { name?: unknown; value?: unknown; color?: string; dataKey?: unknown; payload?: unknown };

/** Small-card tooltip: bold label, then one row per series (line key · name · value). */
export function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
  hideLabel,
}: Partial<TooltipContentProps> & { valueFormatter?: (value: number, name: string) => string; hideLabel?: boolean }) {
  if (!active || !payload?.length) return null;
  const rows = (payload as readonly Entry[]).filter((p) => p.value !== undefined && p.value !== null);
  if (!rows.length) return null;
  return (
    <div className="min-w-[132px] rounded-md border border-border bg-popover px-2.5 py-2 text-xs text-popover-foreground shadow-md">
      {!hideLabel && label !== undefined && label !== null ? <div className="mb-1.5 font-medium">{String(label)}</div> : null}
      <ul className="space-y-1">
        {rows.map((p, i) => {
          const value = typeof p.value === "number" ? p.value : Number(p.value ?? 0);
          const name = String(p.name ?? p.dataKey ?? "");
          const color = p.color ?? (p.payload as { fill?: string } | undefined)?.fill ?? COLORS.c1;
          return (
            <li key={i} className="flex items-center gap-2">
              <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
              <span className="text-muted-foreground">{name}</span>
              <span className="ml-auto pl-3 font-medium tabular-nums">{valueFormatter ? valueFormatter(value, name) : formatNumber(value)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ChartLegend({ items, className }: { items: { name: string; color: string; shape?: "rect" | "line" }[]; className?: string }) {
  return (
    <ul className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground ${className ?? ""}`}>
      {items.map((it) => (
        <li key={it.name} className="inline-flex items-center gap-1.5">
          <span className={it.shape === "line" ? "h-0.5 w-3 rounded-full" : "size-2.5 rounded-[3px]"} style={{ background: it.color }} aria-hidden />
          {it.name}
        </li>
      ))}
    </ul>
  );
}

export function ChartEmpty({ children = "No data for this period" }: { children?: React.ReactNode }) {
  return <div className="flex h-full min-h-[120px] items-center justify-center text-sm text-muted-foreground">{children}</div>;
}
