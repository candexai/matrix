"use client";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { InsightsDashboard, InsightsTaxonomyEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AXIS, BAR_CURSOR, COLORS, ChartEmpty, ChartTooltip, GRID, fmtDay } from "../../chart-theme";
import { tagColor } from "../../insightColors";
import { TagDot } from "../primitives";

/** Stacked calls-per-day by tag (top 8 keys). Colours follow the tag, never the rank. */
export function TagTrends({ trends, taxonomy, selectedKey, onSelect }: { trends: InsightsDashboard["trends"]; taxonomy: InsightsTaxonomyEntry[]; selectedKey?: string; onSelect?: (key?: string) => void }) {
  const meta = useMemo(() => new Map(taxonomy.map((t) => [t.key, t])), [taxonomy]);
  const rows = useMemo<Record<string, number | string>[]>(() => trends.rows.map((r) => ({ ...r, label: fmtDay(r.date) })), [trends.rows]);
  const keys = trends.keys.filter((k) => meta.has(k));
  const total = keys.reduce((a, k) => a + rows.reduce((b, r) => b + Number(r[k] ?? 0), 0), 0);
  if (!keys.length || total === 0) return <ChartEmpty>No tagged calls in this period</ChartEmpty>;
  const dense = rows.length > 40;

  return (
    <div className="flex flex-col gap-3">
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -12 }} barCategoryGap={dense ? 1 : "25%"}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={28} />
            <YAxis {...AXIS} allowDecimals={false} width={40} />
            <Tooltip content={(p) => <ChartTooltip {...p} payload={(p.payload ?? []).filter((e) => Number(e.value) > 0)} />} cursor={BAR_CURSOR} />
            {keys.map((k) => {
              const t = meta.get(k)!;
              const dim = selectedKey && selectedKey !== k;
              return <Bar key={k} dataKey={k} name={t.label} stackId="tags" fill={tagColor(t.color)} fillOpacity={dim ? 0.25 : 1} stroke={COLORS.surface} strokeWidth={1} maxBarSize={28} isAnimationActive={false} onClick={() => onSelect?.(selectedKey === k ? undefined : k)} className={onSelect ? "cursor-pointer" : undefined} />;
            })}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {keys.map((k) => {
          const t = meta.get(k)!;
          const dim = selectedKey && selectedKey !== k;
          return (
            <li key={k}>
              <button type="button" onClick={() => onSelect?.(selectedKey === k ? undefined : k)} className={cn("inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-[11.5px] text-muted-foreground transition-opacity hover:text-foreground", dim && "opacity-50", !onSelect && "pointer-events-none")}>
                <TagDot color={t.color} /> {t.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
