"use client";
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS, BAR_CURSOR, ChartEmpty, ChartTooltip, COLORS } from "../chart-theme";

const truncate = (s: string, n = 20) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Ranked categories → one-hue horizontal bars with the value at the tip. */
export function HorizontalBars({ data, color = COLORS.c1, valueName = "Calls", emptyText }: { data: { name: string; value: number }[]; color?: string; valueName?: string; emptyText?: string }) {
  if (!data.length) return <ChartEmpty>{emptyText}</ChartEmpty>;
  const rows = [...data].sort((a, b) => b.value - a.value);
  const height = Math.max(140, rows.length * 30 + 8);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }} barCategoryGap={8}>
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis type="category" dataKey="name" {...AXIS} width={128} tickFormatter={(v: string) => truncate(v)} />
          <Tooltip content={<ChartTooltip />} cursor={BAR_CURSOR} />
          <Bar dataKey="value" name={valueName} fill={color} radius={[0, 3, 3, 0]} maxBarSize={16} isAnimationActive={false}>
            <LabelList dataKey="value" position="right" fontSize={11} fill="var(--muted-foreground)" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
