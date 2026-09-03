"use client";
import type { AnalyticsDashboard } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

export function LeadFunnel({ leads }: { leads: AnalyticsDashboard["leads"] }) {
  const steps = [
    { label: "Total leads", value: leads.total, opacity: 0.35 },
    { label: "Called", value: leads.called, opacity: 0.55 },
    { label: "Reached", value: leads.reached, opacity: 0.78 },
    { label: "Qualified", value: leads.qualified, opacity: 1 },
  ];
  const max = leads.total || 1;
  return (
    <ol className="flex h-full flex-col justify-center gap-3.5">
      {steps.map((s, i) => {
        const pct = leads.total ? Math.round((s.value / leads.total) * 100) : 0;
        const width = s.value ? Math.max(2, (s.value / max) * 100) : 0;
        return (
          <li key={s.label}>
            <div className="mb-1 flex items-center justify-between text-[13px]">
              <span className="flex items-center gap-2">
                <span className="w-4 text-[11px] tabular-nums text-muted-foreground">{i + 1}</span>
                {s.label}
              </span>
              <span className="tabular-nums">
                {formatNumber(s.value)} <span className="text-muted-foreground">· {pct}%</span>
              </span>
            </div>
            <div className="ml-6 h-2.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${width}%`, opacity: s.opacity }} />
            </div>
          </li>
        );
      })}
      {!leads.total ? <p className="ml-6 text-xs text-muted-foreground">No leads yet — connect Zoho or add leads on My Leads.</p> : null}
    </ol>
  );
}
