"use client";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Tip } from "@/components/ui/tooltip";
import type { InsightsDashboard } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";
import { ChartEmpty } from "../../chart-theme";
import { RISK_BUCKETS, riskBucketFromLabel } from "../../insightColors";

/** Four ordered risk buckets, green → red, with the critical count called out. */
export function LossRiskBars({ lossRisk, enabled = true }: { lossRisk: InsightsDashboard["lossRisk"]; enabled?: boolean }) {
  const counts = [0, 0, 0, 0];
  if (enabled) for (const b of lossRisk) counts[riskBucketFromLabel(b.bucket)] += b.value;
  const total = counts.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...counts);
  const critical = counts[3];
  if (!enabled || total === 0) return <ChartEmpty>No analysed calls in this period</ChartEmpty>;

  return (
    <div className="flex h-full flex-col justify-between gap-4">
      <ol className="space-y-3">
        {RISK_BUCKETS.map((b, i) => {
          const pct = total ? Math.round((counts[i] / total) * 100) : 0;
          return (
            <li key={b.key}>
              <div className="mb-1 flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-[3px]" style={{ background: `var(--insight-risk-${i})` }} aria-hidden />
                  {b.label}
                  <span className="text-[11px] text-muted-foreground">{b.range}</span>
                </span>
                <span className="tabular-nums">
                  {formatNumber(counts[i])} <span className="text-muted-foreground">· {pct}%</span>
                </span>
              </div>
              <Tip label={`${b.label} risk · ${formatNumber(counts[i])} call${counts[i] === 1 ? "" : "s"} (${pct}%)`}>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${counts[i] ? Math.max(2, (counts[i] / max) * 100) : 0}%`, background: `var(--insight-risk-${i})` }} />
                </div>
              </Tip>
            </li>
          );
        })}
      </ol>
      <div className={cn("flex items-center gap-2.5 rounded-lg border px-3 py-2 text-[13px]", critical ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-border bg-muted/40 text-muted-foreground")}>
        {critical ? <ShieldAlert className="size-4 shrink-0" strokeWidth={1.8} /> : <ShieldCheck className="size-4 shrink-0" strokeWidth={1.8} />}
        {critical ? (
          <span>
            <span className="font-medium tabular-nums">{formatNumber(critical)}</span> call{critical === 1 ? "" : "s"} at critical risk of being lost — follow up first.
          </span>
        ) : (
          <span>No calls at critical risk in this period.</span>
        )}
      </div>
    </div>
  );
}
