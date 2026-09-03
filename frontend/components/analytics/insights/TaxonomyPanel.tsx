"use client";
import { useMemo } from "react";
import { Tags } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tip } from "@/components/ui/tooltip";
import type { InsightsDashboard, InsightsTaxonomyEntry } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";
import { tagColor } from "../insightColors";
import { CategoryChip, RiskMeter, Spark, TagDot } from "./primitives";

/** Per-tag daily series for the top-8 keys present in `trends`. */
export function useTagSeries(trends: InsightsDashboard["trends"] | undefined) {
  return useMemo(() => {
    const map = new Map<string, number[]>();
    if (!trends) return map;
    for (const k of trends.keys) map.set(k, trends.rows.map((r) => Number(r[k] ?? 0)));
    return map;
  }, [trends]);
}

function CapacityBar({ taxonomy, cap }: { taxonomy: InsightsTaxonomyEntry[]; cap: number }) {
  const used = Math.min(taxonomy.length, cap);
  const free = Math.max(0, cap - used);
  const full = free === 0;
  return (
    <div>
      <div className="flex items-center gap-1" role="img" aria-label={`${used} of ${cap} taxonomy slots used`}>
        {Array.from({ length: cap }).map((_, i) => {
          const t = taxonomy[i];
          return t ? (
            <Tip key={t.key} label={t.label}>
              <span className="h-1.5 flex-1 rounded-full" style={{ background: tagColor(t.color) }} />
            </Tip>
          ) : (
            <span key={`free-${i}`} className="h-1.5 flex-1 rounded-full border border-dashed border-border" />
          );
        })}
      </div>
      <p className={cn("mt-1.5 text-[11.5px]", full ? "text-warning" : "text-muted-foreground")}>
        {full ? "Taxonomy is full — new patterns will merge similar tags" : `${used} used · ${free} free slot${free === 1 ? "" : "s"}`}
      </p>
    </div>
  );
}

function TagRow({ tag, rank, series, selected, onSelect }: { tag: InsightsTaxonomyEntry; rank: number; series?: number[]; selected: boolean; onSelect: (key: string) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(tag.key)}
        aria-pressed={selected}
        className={cn(
          "grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 border-l-2 px-3 py-2.5 text-left transition-colors",
          selected ? "border-l-primary bg-accent-tint/50" : "border-l-transparent hover:bg-muted/50"
        )}
      >
        <span className="flex items-center gap-2 pt-0.5">
          <span className="w-4 text-right text-[11px] tabular-nums text-muted-foreground">{rank}</span>
          <TagDot color={tag.color} className="size-2.5" />
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate text-[13.5px] font-medium leading-5">{tag.label}</span>
            <CategoryChip category={tag.category} />
          </span>
          <span className="mt-1.5 flex items-center gap-2">
            <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full transition-[width] duration-300" style={{ width: `${tag.count ? Math.max(2, tag.share) : 0}%`, background: tagColor(tag.color) }} />
            </span>
            <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{tag.share}%</span>
          </span>
        </span>
        <span className="flex flex-col items-end gap-1.5">
          <Tip label={`${formatNumber(tag.count)} in range · ${formatNumber(tag.countAllTime)} all time`}>
            <span className="text-[13px] tabular-nums leading-5">{formatNumber(tag.count)}</span>
          </Tip>
          <span className="flex items-center gap-2">
            <RiskMeter risk={tag.avgLossRisk} />
            {series ? <Spark values={series} color={tagColor(tag.color)} /> : <span className="inline-block w-14" aria-hidden />}
          </span>
        </span>
      </button>
    </li>
  );
}

export function TaxonomyPanel({
  taxonomy,
  cap,
  trends,
  selectedKey,
  onSelect,
  className,
}: {
  taxonomy: InsightsTaxonomyEntry[];
  cap: number;
  trends: InsightsDashboard["trends"];
  selectedKey?: string;
  onSelect: (key: string) => void;
  className?: string;
}) {
  const series = useTagSeries(trends);
  const ranked = useMemo(() => [...taxonomy].sort((a, b) => b.count - a.count || b.countAllTime - a.countAllTime), [taxonomy]);

  return (
    <Card className={cn("flex min-w-0 flex-col", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>
              Tag taxonomy <span className="ml-1 font-sans text-[13px] tabular-nums text-muted-foreground">{taxonomy.length}/{cap}</span>
            </CardTitle>
            <CardDescription className="mt-0.5 text-[13px]">Ranked by share of analysed calls in this period</CardDescription>
          </div>
        </div>
        <div className="mt-3">
          <CapacityBar taxonomy={ranked} cap={cap} />
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        {ranked.length ? (
          <>
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 border-b border-border px-3 pb-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              <span className="w-[38px]">#</span>
              <span>Tag · share</span>
              <span className="text-right">Calls · risk · trend</span>
            </div>
            <ol className="divide-y divide-border/60">
              {ranked.map((t, i) => (
                <TagRow key={t.key} tag={t} rank={i + 1} series={series.get(t.key)} selected={t.key === selectedKey} onSelect={onSelect} />
              ))}
            </ol>
          </>
        ) : (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-xl border border-border bg-muted/50">
              <Tags className="size-5 text-primary" strokeWidth={1.6} />
            </div>
            <p className="text-sm font-medium">No tags yet</p>
            <p className="mt-1 max-w-[260px] text-[13px] text-muted-foreground">The taxonomy is built by AI from the first analysed call and grows to at most {cap} tags.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
