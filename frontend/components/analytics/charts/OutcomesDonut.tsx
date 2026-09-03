"use client";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatNumber } from "@/lib/utils";
import { COLORS, ChartTooltip } from "../chart-theme";

const ORDER: { key: string; name: string; color: string }[] = [
  { key: "success", name: "Successful", color: COLORS.success },
  { key: "failure", name: "Failed", color: COLORS.destructive },
  { key: "unknown", name: "Unknown", color: COLORS.muted },
];

export function OutcomesDonut({ result }: { result: { name: string; value: number }[] }) {
  const rows = ORDER.map((o) => ({ ...o, value: result.find((r) => r.name === o.key)?.value ?? 0 }));
  const extra = result.filter((r) => !ORDER.some((o) => o.key === r.name)).reduce((a, r) => a + r.value, 0);
  if (extra > 0) rows[2] = { ...rows[2], value: rows[2].value + extra };
  const total = rows.reduce((a, r) => a + r.value, 0);
  const slices = rows.filter((r) => r.value > 0);
  const pieData = slices.length ? slices : [{ key: "empty", name: "No calls", color: "var(--muted)", value: 1 }];

  return (
    <div className="flex items-center gap-6">
      <div className="relative size-[184px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="94%" paddingAngle={slices.length > 1 ? 2 : 0} cornerRadius={3} stroke={COLORS.surface} strokeWidth={2} isAnimationActive={false}>
              {pieData.map((d) => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Pie>
            {slices.length ? <Tooltip content={<ChartTooltip hideLabel />} /> : null}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-heading text-[28px] leading-none">{formatNumber(total)}</span>
          <span className="mt-1 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">calls</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2.5">
        {rows.map((r) => {
          const pct = total ? Math.round((r.value / total) * 100) : 0;
          return (
            <li key={r.key} className="flex items-center gap-2.5 text-[13px]">
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: r.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{r.name}</span>
              <span className="tabular-nums">{formatNumber(r.value)}</span>
              <span className="w-10 text-right tabular-nums text-muted-foreground">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
