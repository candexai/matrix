"use client";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tip } from "@/components/ui/tooltip";
import type { InsightsDashboard, InsightsTaxonomyEntry } from "@/lib/types";
import { formatDateTime, formatDuration, relativeTime } from "@/lib/utils";
import { riskPct } from "../insightColors";
import { RiskMeter, SentimentBadge, TagChip } from "./primitives";

export function RecentCalls({ recent, taxonomy }: { recent: InsightsDashboard["recent"]; taxonomy: InsightsTaxonomyEntry[] }) {
  const router = useRouter();
  if (!recent.length) {
    return <EmptyState icon={Sparkles} title="No analysed calls yet" description="Calls read and tagged by AI in this period will be listed here with their sentiment, risk and next best action." className="py-8" />;
  }
  const colorOf = (key: string) => taxonomy.find((t) => t.key === key)?.color ?? null;
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table className="min-w-[1100px]">
        <TableHeader>
          <TableRow>
            <TableHead>Lead</TableHead>
            <TableHead>Agent</TableHead>
            <TableHead>When</TableHead>
            <TableHead className="text-right">Duration</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>Sentiment</TableHead>
            <TableHead>Loss risk</TableHead>
            <TableHead>Key quote</TableHead>
            <TableHead>Next best action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recent.map((c) => {
            const ins = c.insights;
            const tags = ins.tags ?? [];
            const open = () => router.push(`/conversations?id=${encodeURIComponent(c._id)}`);
            return (
              <TableRow
                key={c._id}
                className="cursor-pointer"
                onClick={open}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    open();
                  }
                }}
              >
                <TableCell>
                  <div className="max-w-[160px]">
                    <div className="truncate text-[13.5px] font-medium">{c.leadName || c.phone || "Unknown caller"}</div>
                    {c.summaryTitle ? <div className="truncate text-[11.5px] text-muted-foreground">{c.summaryTitle}</div> : null}
                  </div>
                </TableCell>
                <TableCell className="max-w-[140px] truncate text-[13px] text-muted-foreground">{c.agentName || "Agent"}</TableCell>
                <TableCell className="whitespace-nowrap text-[13px] text-muted-foreground">
                  <Tip label={formatDateTime(c.startedAt)}>
                    <span>{relativeTime(c.startedAt)}</span>
                  </Tip>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatDuration(c.durationSecs)}</TableCell>
                <TableCell>
                  <div className="flex max-w-[260px] flex-wrap gap-1">
                    {tags.slice(0, 3).map((t) => (
                      <TagChip key={t.key} label={t.label} color={colorOf(t.key)} size="xs" title={t.evidence ? `“${t.evidence}”` : t.label} />
                    ))}
                    {tags.length > 3 ? <span className="self-center text-[10.5px] text-muted-foreground">+{tags.length - 3}</span> : null}
                  </div>
                </TableCell>
                <TableCell>
                  <SentimentBadge sentiment={ins.sentiment} score={ins.sentimentScore} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <RiskMeter risk={ins.lossRisk} trackClassName="w-14" />
                    <span className="text-[12.5px] tabular-nums text-muted-foreground">{riskPct(ins.lossRisk)}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  <p className="max-w-[240px] truncate text-[12.5px] italic text-muted-foreground" title={ins.keyQuote}>
                    {ins.keyQuote ? `“${ins.keyQuote}”` : "—"}
                  </p>
                </TableCell>
                <TableCell>
                  <p className="max-w-[260px] truncate text-[13px]" title={ins.nextBestAction}>
                    {ins.nextBestAction || "—"}
                  </p>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
