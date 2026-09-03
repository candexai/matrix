"use client";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/card";
import { Tip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { COLORS } from "./chart-theme";

export interface MetricDelta {
  current: number;
  previous: number;
  /** e.g. "previous 30 days" */
  period: string;
}

function DeltaChip({ current, previous, period }: MetricDelta) {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) {
    return (
      <Tip label={`No calls in the ${period}`}>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">New</span>
      </Tip>
    );
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  const up = pct > 0;
  const flat = pct === 0;
  return (
    <Tip label={`${current} vs ${previous} in the ${period}`}>
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
          flat ? "bg-muted text-muted-foreground" : up ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
        )}
      >
        <span aria-hidden>{flat ? "–" : up ? "▲" : "▼"}</span>
        {Math.abs(pct)}%
      </span>
    </Tip>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const rows = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={rows} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <Area type="monotone" dataKey="v" stroke={COLORS.c1} strokeWidth={1.5} fill={COLORS.c1} fillOpacity={0.3} dot={false} activeDot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MetricCard({ label, value, delta, sub, spark, className }: { label: string; value: string; delta?: MetricDelta; sub?: string; spark?: number[]; className?: string }) {
  return (
    <Card className={cn("flex min-w-0 flex-col p-4", className)}>
      <span className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="truncate font-heading text-[28px] leading-none">{value}</span>
        {delta ? <DeltaChip {...delta} /> : null}
      </div>
      {sub ? <div className="mt-1.5 truncate text-xs text-muted-foreground">{sub}</div> : null}
      {spark && spark.length > 1 ? (
        <div className="-mx-1 mt-3 h-9" aria-hidden>
          <Sparkline data={spark} />
        </div>
      ) : null}
    </Card>
  );
}
