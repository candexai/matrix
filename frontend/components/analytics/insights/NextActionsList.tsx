"use client";
import { Lightbulb } from "lucide-react";
import type { InsightsDashboard } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import { ChartEmpty } from "../chart-theme";

/** Ranked list of the AI's recommended next actions with counts. */
export function NextActionsList({ actions }: { actions: InsightsDashboard["nextActions"] }) {
  const rows = [...actions].sort((a, b) => b.value - a.value);
  if (!rows.length) return <ChartEmpty>No recommended actions yet</ChartEmpty>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ol className="space-y-1">
      {rows.map((a, i) => (
        <li key={`${a.name}-${i}`} className="relative flex items-start gap-3 overflow-hidden rounded-md px-2.5 py-2">
          <span className="absolute inset-y-0 left-0 rounded-md bg-accent-tint/60" style={{ width: `${(a.value / max) * 100}%` }} aria-hidden />
          <span className="relative mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-card text-[11px] tabular-nums text-muted-foreground ring-1 ring-border">{i + 1}</span>
          <span className="relative min-w-0 flex-1">
            <span className="line-clamp-2 text-[13.5px] leading-snug">{a.name}</span>
          </span>
          <span className="relative shrink-0 rounded-full bg-card px-2 py-0.5 text-[11.5px] font-medium tabular-nums ring-1 ring-border">
            {formatNumber(a.value)}
            <Lightbulb className="ml-1 inline size-3 text-primary" strokeWidth={1.8} aria-hidden />
          </span>
        </li>
      ))}
    </ol>
  );
}
