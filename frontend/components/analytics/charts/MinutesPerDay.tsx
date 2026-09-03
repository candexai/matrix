"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS, COLORS, ChartTooltip, GRID, LINE_CURSOR, fmtMinutes } from "../chart-theme";
import type { DayRow } from "./CallsPerDay";

export function MinutesPerDay({ data }: { data: DayRow[] }) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="minutesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.c1} stopOpacity={0.28} />
              <stop offset="100%" stopColor={COLORS.c1} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={28} />
          <YAxis {...AXIS} width={40} tickFormatter={(v: number) => `${v}`} />
          <Tooltip content={<ChartTooltip valueFormatter={(v) => fmtMinutes(v)} />} cursor={LINE_CURSOR} />
          <Area type="monotone" dataKey="minutes" name="Minutes" stroke={COLORS.c1} strokeWidth={1.5} fill="url(#minutesFill)" dot={false} activeDot={{ r: 4, stroke: COLORS.surface, strokeWidth: 2, fill: COLORS.c1 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
