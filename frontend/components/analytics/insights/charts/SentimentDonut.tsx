"use client";
import { useMemo } from "react";
import { Cell, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { InsightsDashboard } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";
import { AXIS, COLORS, ChartEmpty, ChartTooltip, LINE_CURSOR, fmtDay } from "../../chart-theme";
import { SENTIMENTS, SENTIMENT_ORDER, formatScore, type SentimentKey } from "../../insightColors";

export function SentimentDonut({ distribution, trend, enabled = true }: { distribution: InsightsDashboard["sentiment"]["distribution"]; trend: InsightsDashboard["sentiment"]["trend"]; enabled?: boolean }) {
  const rows = useMemo(() => {
    const byName = new Map(distribution.map((d) => [d.name, d]));
    const extra = distribution.filter((d) => !(d.name in SENTIMENTS)).reduce((a, d) => a + d.value, 0);
    return SENTIMENT_ORDER.map((k: SentimentKey) => ({ key: k, ...SENTIMENTS[k], value: (byName.get(k)?.value ?? 0) + (k === "neutral" ? extra : 0), avg: byName.get(k)?.avg ?? null }));
  }, [distribution]);
  const total = enabled ? rows.reduce((a, r) => a + r.value, 0) : 0;
  const weighted = total ? rows.reduce((a, r) => a + (r.avg ?? 0) * r.value, 0) / total : null;
  const slices = rows.filter((r) => r.value > 0);
  const pieData = enabled && slices.length ? slices : [{ key: "empty", label: "No calls", color: "var(--muted)", value: 1, avg: null, variant: "secondary" as const }];
  const line = useMemo(() => trend.map((t) => ({ label: fmtDay(t.date), score: t.avgSentiment, calls: t.calls })), [trend]);
  const hasLine = enabled && line.some((p) => p.score !== null);

  if (!enabled || total === 0) return <ChartEmpty>No analysed calls in this period</ChartEmpty>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-5">
        <div className="relative size-[150px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="label" innerRadius="70%" outerRadius="96%" paddingAngle={slices.length > 1 ? 2 : 0} cornerRadius={3} stroke={COLORS.surface} strokeWidth={2} isAnimationActive={false}>
                {pieData.map((d) => (
                  <Cell key={d.key} fill={d.color} />
                ))}
              </Pie>
              {slices.length ? <Tooltip content={<ChartTooltip hideLabel />} /> : null}
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("font-heading text-[24px] leading-none tabular-nums", weighted !== null && weighted > 0.25 && "text-success", weighted !== null && weighted < -0.25 && "text-destructive")}>{formatScore(weighted)}</span>
            <span className="mt-1 text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">avg score</span>
          </div>
        </div>
        <ul className="min-w-0 flex-1 space-y-2.5">
          {rows.map((r) => {
            const pct = total ? Math.round((r.value / total) * 100) : 0;
            return (
              <li key={r.key} className="flex items-center gap-2.5 text-[13px]">
                <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: r.color }} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{r.label}</span>
                <span className="hidden text-[11px] tabular-nums text-muted-foreground sm:inline">{r.avg === null ? "" : formatScore(r.avg)}</span>
                <span className="tabular-nums">{formatNumber(r.value)}</span>
                <span className="w-10 text-right tabular-nums text-muted-foreground">{pct}%</span>
              </li>
            );
          })}
        </ul>
      </div>
      {hasLine ? (
        <div>
          <div className="mb-1 text-[11px] text-muted-foreground">Average sentiment per day</div>
          <div className="h-[84px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={line} margin={{ top: 4, right: 6, bottom: 0, left: -18 }}>
                <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={28} hide />
                <YAxis {...AXIS} domain={[-1, 1]} ticks={[-1, 0, 1]} width={40} tickFormatter={(v: number) => (v > 0 ? `+${v}` : `${v}`)} />
                <ReferenceLine y={0} stroke={COLORS.grid} />
                <Tooltip content={<ChartTooltip valueFormatter={(v) => formatScore(v)} />} cursor={LINE_CURSOR} />
                <Line type="monotone" dataKey="score" name="Avg sentiment" stroke={COLORS.c1} strokeWidth={2} dot={false} connectNulls activeDot={{ r: 4, stroke: COLORS.surface, strokeWidth: 2, fill: COLORS.c1 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
