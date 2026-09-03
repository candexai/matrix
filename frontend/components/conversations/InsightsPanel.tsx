"use client";
import { Lightbulb, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import { InsightPaletteStyle } from "@/components/analytics/insights/InsightPaletteStyle";
import { CategoryChip, RiskMeter, SentimentBadge, SentimentMeter, TagChip } from "@/components/analytics/insights/primitives";
import { riskLabel, riskPct } from "@/components/analytics/insightColors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAnalyzeConversation, useInsightTags } from "@/hooks/api";
import type { Conversation } from "@/lib/types";
import { cn, formatDateTime, relativeTime } from "@/lib/utils";

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-3">
      <h4 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{children}</h4>
      {right}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{children}</div>;
}

/** AI insights for one conversation: tags with evidence, sentiment, risk, objections and next best action. */
export function InsightsPanel({ c }: { c: Conversation }) {
  const analyze = useAnalyzeConversation();
  const { data: tagDefs } = useInsightTags();
  const ins = c.insights;
  const colorOf = (key: string) => tagDefs?.find((t) => t.key === key)?.color ?? null;
  const canAnalyse = c.status === "done";
  const run = () => analyze.mutate({ id: c._id, force: true });
  const analyseButton = (label: string) => (
    <Button variant="outline" size="xs" onClick={run} loading={analyze.isPending} disabled={!canAnalyse}>
      {analyze.isPending ? null : <Sparkles />} {label}
    </Button>
  );

  if (!ins || !ins.tags?.length) {
    const failed = Boolean(ins?.error);
    const text = !ins ? "Not analysed yet." : failed ? `Analysis failed: ${ins.error}` : ins.skipped ? `Skipped — ${ins.skipped}.` : "No tags were assigned to this call.";
    return (
      <section>
        <InsightPaletteStyle />
        <SectionTitle>AI insights</SectionTitle>
        <div className={cn("flex items-center gap-3 rounded-lg border border-dashed px-4 py-3 text-sm", failed ? "border-destructive/40 text-destructive" : "border-border text-muted-foreground")}>
          {failed ? <TriangleAlert className="size-4 shrink-0" strokeWidth={1.8} /> : <Sparkles className="size-4 shrink-0" strokeWidth={1.8} />}
          <span className="min-w-0 flex-1">
            {text}
            {!canAnalyse ? <span className="ml-1">Insights are generated once the call has finished.</span> : null}
          </span>
          {analyseButton("Analyse now")}
        </div>
      </section>
    );
  }

  return (
    <section>
      <InsightPaletteStyle />
      <SectionTitle
        right={
          <Button variant="ghost" size="xs" onClick={run} loading={analyze.isPending}>
            {analyze.isPending ? null : <RefreshCw />} Re-analyse
          </Button>
        }
      >
        AI insights
      </SectionTitle>
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-b border-border p-4 sm:grid-cols-4">
          <div className="min-w-0">
            <Label>Sentiment</Label>
            <SentimentBadge sentiment={ins.sentiment} score={ins.sentimentScore} />
            <SentimentMeter score={ins.sentimentScore} className="mt-2 max-w-[140px]" />
          </div>
          <div className="min-w-0">
            <Label>Caller mood</Label>
            <div className="truncate text-[13.5px]">{ins.callerMood || "—"}</div>
          </div>
          <div className="min-w-0">
            <Label>Intent</Label>
            <div className="line-clamp-2 text-[13.5px] leading-snug">{ins.intent || "—"}</div>
          </div>
          <div className="min-w-0">
            <Label>Outcome</Label>
            <div className="line-clamp-2 text-[13.5px] leading-snug">{ins.outcome || "—"}</div>
          </div>
        </div>

        <div className="border-b border-border p-4">
          <Label>Tags</Label>
          <ul className="space-y-2.5">
            {ins.tags.map((t) => (
              <li key={t.key} className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <TagChip label={t.label} color={colorOf(t.key)} href={`/conversations?tag=${encodeURIComponent(t.key)}`} title={`View all calls tagged ${t.label}`} />
                  <CategoryChip category={t.category} />
                </div>
                {t.evidence ? <p className="mt-1 pl-1 text-[12.5px] italic leading-relaxed text-muted-foreground">“{t.evidence}”</p> : null}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-4 border-b border-border p-4 sm:grid-cols-2">
          <div>
            <Label>Loss risk</Label>
            <div className="flex items-center gap-3">
              <RiskMeter risk={ins.lossRisk} trackClassName="w-full max-w-[160px] h-2" />
              <span className="text-[13.5px] tabular-nums">
                {riskPct(ins.lossRisk)}% <span className="text-muted-foreground">· {riskLabel(ins.lossRisk)}</span>
              </span>
            </div>
          </div>
          <div className="min-w-0">
            <Label>Objections</Label>
            {ins.objections?.length ? (
              <div className="flex flex-wrap gap-1">
                {ins.objections.map((o) => (
                  <Badge key={o} variant="warning">
                    {o}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-[13.5px] text-muted-foreground">None raised</span>
            )}
          </div>
        </div>

        {ins.nextBestAction ? (
          <div className="m-4 flex items-start gap-3 rounded-lg border border-primary/30 bg-accent-tint/50 p-3.5">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary-hover" strokeWidth={1.8} />
            <div className="min-w-0">
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-primary-hover">Next best action</div>
              <p className="mt-0.5 text-[14px] leading-relaxed">{ins.nextBestAction}</p>
            </div>
          </div>
        ) : null}

        {ins.keyQuote ? (
          <blockquote className="mx-4 mb-4 border-l-2 border-primary/50 pl-3 text-[13.5px] italic leading-relaxed text-foreground/90">“{ins.keyQuote}”</blockquote>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-1.5 border-t border-border bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
          <span title={formatDateTime(ins.analyzedAt)}>Analysed {relativeTime(ins.analyzedAt)}</span>
          {ins.model ? (
            <>
              <span aria-hidden>·</span>
              <span className="font-mono">{ins.model}</span>
            </>
          ) : null}
          {ins.merges?.length ? (
            <>
              <span aria-hidden>·</span>
              <span>{ins.merges.length} taxonomy merge{ins.merges.length === 1 ? "" : "s"} applied during this analysis</span>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
