"use client";
import { Fragment } from "react";
import { Tip } from "@/components/ui/tooltip";
import type { AnalyticsDashboard } from "@/lib/types";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** 7 × 24 activity grid. `dow` is Mongo's $dayOfWeek (1 = Sunday … 7 = Saturday); hours are in the workspace timezone returned by the API. */
export function Heatmap({ heatmap }: { heatmap: AnalyticsDashboard["heatmap"] }) {
  const grid: number[][] = DOW.map(() => HOURS.map(() => 0));
  for (const cell of heatmap) {
    const r = cell.dow - 1;
    if (r >= 0 && r < 7 && cell.hour >= 0 && cell.hour < 24) grid[r][cell.hour] += cell.count;
  }
  const max = Math.max(0, ...grid.flat());

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[620px]">
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: "36px repeat(24, minmax(0, 1fr))" }}>
          {DOW.map((day, r) => (
            <Fragment key={day}>
              <div className="flex h-4 items-center text-[11px] text-muted-foreground">{day}</div>
              {HOURS.map((h) => {
                const n = grid[r][h];
                const label = `${day} ${String(h).padStart(2, "0")}:00 · ${n} call${n === 1 ? "" : "s"}`;
                return (
                  <Tip key={h} label={label}>
                    <div
                      role="img"
                      aria-label={label}
                      className="h-4 rounded-[3px] transition-transform hover:scale-110"
                      style={n ? { background: "var(--chart-1)", opacity: 0.18 + 0.82 * (n / (max || 1)) } : { background: "var(--muted)" }}
                    />
                  </Tip>
                );
              })}
            </Fragment>
          ))}
          <div />
          {HOURS.map((h) => (
            <div key={h} className="text-center text-[10px] tabular-nums text-muted-foreground">
              {h % 3 === 0 ? h : ""}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
          <span>Less</span>
          {[0.18, 0.4, 0.6, 0.8, 1].map((o) => (
            <span key={o} className="size-3 rounded-[3px]" style={{ background: "var(--chart-1)", opacity: o }} aria-hidden />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
