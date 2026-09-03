"use client";
import { ArrowRight, Bot, GitMerge, UserRound } from "lucide-react";
import { Tip } from "@/components/ui/tooltip";
import type { InsightsDashboard, InsightsTaxonomyEntry } from "@/lib/types";
import { formatDateTime, formatNumber, relativeTime } from "@/lib/utils";
import { ChartEmpty } from "../chart-theme";
import { TagChip } from "./primitives";

/** Timeline of taxonomy merges (newest first). */
export function MergeTimeline({ merges, taxonomy, onSelect }: { merges: InsightsDashboard["merges"]; taxonomy: InsightsTaxonomyEntry[]; onSelect?: (key: string) => void }) {
  if (!merges.length) return <ChartEmpty>No merges yet — the taxonomy still has room for new patterns</ChartEmpty>;
  const colorOf = (key: string) => taxonomy.find((t) => t.key === key)?.color ?? null;
  return (
    <ol className="relative space-y-4 pl-6">
      <span className="absolute bottom-2 left-[9px] top-2 w-px bg-border" aria-hidden />
      {merges.map((m, i) => {
        const Who = m.by === "llm" ? Bot : UserRound;
        return (
          <li key={`${m.from}-${m.into}-${m.at}-${i}`} className="relative">
            <span className="absolute -left-6 top-0.5 flex size-[19px] items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
              <GitMerge className="size-3" strokeWidth={2} />
            </span>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <TagChip label={m.fromLabel} color={null} title={`${m.fromLabel} (retired)`} />
              <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
              <TagChip label={m.intoLabel} color={colorOf(m.into)} onClick={onSelect && colorOf(m.into) !== null ? () => onSelect(m.into) : undefined} />
              <span className="text-[12.5px] text-muted-foreground">
                +{formatNumber(m.count)} call{m.count === 1 ? "" : "s"} summed
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted-foreground">
              <Who className="size-3" strokeWidth={1.8} aria-hidden />
              <span>by {m.by === "llm" ? "AI" : "you"}</span>
              <span aria-hidden>·</span>
              <Tip label={formatDateTime(m.at)}>
                <span>{relativeTime(m.at)}</span>
              </Tip>
              {m.reason ? <span className="basis-full italic sm:basis-auto sm:before:mr-1.5 sm:before:content-['·']">{m.reason}</span> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
