"use client";
import { PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { Tip } from "@/components/ui/tooltip";
import { formatNumber } from "@/lib/utils";
import { COLORS } from "../chart-theme";

export function DirectionBar({ direction }: { direction: { name: string; value: number }[] }) {
  const inbound = direction.find((d) => d.name === "inbound")?.value ?? 0;
  const outbound = direction.find((d) => d.name === "outbound")?.value ?? 0;
  const unknown = direction.filter((d) => d.name !== "inbound" && d.name !== "outbound").reduce((a, d) => a + d.value, 0);
  const total = inbound + outbound + unknown;
  const segs = [
    { key: "outbound", name: "Outbound", value: outbound, color: COLORS.c1, icon: PhoneOutgoing },
    { key: "inbound", name: "Inbound", value: inbound, color: COLORS.c2, icon: PhoneIncoming },
    ...(unknown ? [{ key: "unknown", name: "Unknown", value: unknown, color: COLORS.muted, icon: PhoneOutgoing }] : []),
  ];
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);

  return (
    <div className="flex h-full flex-col justify-center gap-5">
      <div className="flex h-5 w-full gap-0.5 overflow-hidden rounded-md" role="img" aria-label={`Outbound ${outbound}, inbound ${inbound}`}>
        {total === 0 ? (
          <div className="flex-1 rounded-md bg-muted" />
        ) : (
          segs
            .filter((s) => s.value > 0)
            .map((s) => (
              <Tip key={s.key} label={`${s.name} · ${formatNumber(s.value)} (${pct(s.value)}%)`}>
                <div className="h-full rounded-[3px] transition-opacity hover:opacity-80" style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
              </Tip>
            ))
        )}
      </div>
      <ul className="space-y-2">
        {segs.map((s) => {
          const Icon = s.icon;
          return (
            <li key={s.key} className="flex items-center gap-2.5 text-[13px]">
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} aria-hidden />
              <Icon className="size-3.5 text-muted-foreground" strokeWidth={1.8} />
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              <span className="tabular-nums">{formatNumber(s.value)}</span>
              <span className="w-10 text-right tabular-nums text-muted-foreground">{pct(s.value)}%</span>
            </li>
          );
        })}
      </ul>
      {total === 0 ? <p className="text-xs text-muted-foreground">No calls in this period.</p> : null}
    </div>
  );
}
