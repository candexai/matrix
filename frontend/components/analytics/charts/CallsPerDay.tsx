"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS, BAR_CURSOR, COLORS, ChartLegend, ChartTooltip, GRID } from "../chart-theme";

export interface DayRow {
  date: string;
  label: string;
  calls: number;
  minutes: number;
  success: number;
  failed: number;
  other: number;
}

const LEGEND = [
  { name: "Successful", color: COLORS.success },
  { name: "Failed", color: COLORS.destructive },
  { name: "Other", color: COLORS.c1 },
];

export function CallsPerDay({ data }: { data: DayRow[] }) {
  const dense = data.length > 40;
  return (
    <div className="flex flex-col gap-3">
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -12 }} barCategoryGap={dense ? 1 : "25%"}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={28} />
            <YAxis {...AXIS} allowDecimals={false} width={40} />
            <Tooltip content={<ChartTooltip />} cursor={BAR_CURSOR} />
            <Bar dataKey="success" name="Successful" stackId="calls" fill={COLORS.success} stroke={COLORS.surface} strokeWidth={1} maxBarSize={24} />
            <Bar dataKey="failed" name="Failed" stackId="calls" fill={COLORS.destructive} stroke={COLORS.surface} strokeWidth={1} maxBarSize={24} />
            <Bar dataKey="other" name="Other" stackId="calls" fill={COLORS.c1} stroke={COLORS.surface} strokeWidth={1} maxBarSize={24} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend items={LEGEND} />
    </div>
  );
}
