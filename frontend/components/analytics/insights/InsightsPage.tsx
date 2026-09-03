"use client";
import { useState } from "react";
import Link from "next/link";
import { CircleAlert, KeyRound, RefreshCw, Sparkles } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tip } from "@/components/ui/tooltip";
import { useAnalyzePending, useInsights } from "@/hooks/api";
import { errorMessage } from "@/lib/api";
import type { InsightsDashboard } from "@/lib/types";
import { cn, formatNumber, relativeTime } from "@/lib/utils";
import { ChartCard } from "../ChartCard";
import { COLORS } from "../chart-theme";
import { HorizontalBars } from "../charts/HorizontalBars";
import { InsightPaletteStyle } from "./InsightPaletteStyle";
import { MergeTimeline } from "./MergeTimeline";
import { NextActionsList } from "./NextActionsList";
import { RecentCalls } from "./RecentCalls";
import { TagDetailSheet } from "./TagDetailSheet";
import { TaxonomyPanel } from "./TaxonomyPanel";
import { LossRiskBars } from "./charts/LossRiskBars";
import { SentimentDonut } from "./charts/SentimentDonut";
import { TagTrends } from "./charts/TagTrends";

export function InsightsSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-7 pb-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-3.5 w-[520px] max-w-full" />
        </div>
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 p-5 xl:col-span-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-3 h-1.5 w-full" />
          <div className="mt-5 space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-2.5 rounded-full" />
                <Skeleton className="h-3.5 flex-1" />
                <Skeleton className="h-3 w-10" />
              </div>
            ))}
          </div>
        </Card>
        <div className="col-span-12 grid grid-cols-1 gap-4 md:grid-cols-2 xl:col-span-7">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className={cn("p-5", i === 0 && "md:col-span-2")}>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2 h-3 w-48" />
              <Skeleton className={cn("mt-5 w-full", i === 0 ? "h-[240px]" : "h-[180px]")} />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function CoveragePill({ coverage }: { coverage: InsightsDashboard["coverage"] }) {
  const dot = !coverage.configured ? "bg-warning" : coverage.done === 0 ? "bg-muted-foreground/50" : coverage.pending > 0 ? "bg-warning" : "bg-success";
  return (
    <Tip label={coverage.configured ? `${formatNumber(coverage.pending)} completed call${coverage.pending === 1 ? "" : "s"} waiting for analysis` : "OpenAI is not configured"}>
      <span className="inline-flex h-8 items-center gap-2 rounded-full border border-border bg-card px-3 text-[12.5px]">
        <span className={cn("size-1.5 rounded-full", dot)} aria-hidden />
        <span className="font-medium tabular-nums">{formatNumber(coverage.analyzed)}</span>
        <span className="text-muted-foreground">of {formatNumber(coverage.done)} calls analysed</span>
      </span>
    </Tip>
  );
}

export function InsightsPage({ days, rangeControl }: { days: number; rangeControl?: React.ReactNode }) {
  const { data, isLoading, isError, error, refetch, isFetching, isPlaceholderData, dataUpdatedAt } = useInsights({ days });
  const analyze = useAnalyzePending();
  const [selectedKey, setSelectedKey] = useState<string | undefined>();
  const [sheetOpen, setSheetOpen] = useState(false);

  const selectTag = (key?: string) => {
    setSelectedKey(key);
    setSheetOpen(Boolean(key));
  };

  if (isLoading) return <InsightsSkeleton />;
  if (isError || !data) {
    return (
      <div className="px-7 pb-8">
        <Card>
          <EmptyState
            icon={CircleAlert}
            title="Couldn't load insights"
            description={isError ? errorMessage(error) : "No data returned."}
            action={
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const { coverage, cap, taxonomy } = data;
  const analysed = coverage.analyzed > 0;
  const selected = taxonomy.find((t) => t.key === selectedKey) ?? null;
  const analyseButton =
    coverage.pending > 0 && coverage.configured ? (
      <Tip label={`Read and tag the ${formatNumber(coverage.pending)} completed call${coverage.pending === 1 ? "" : "s"} that have no insights yet`}>
        <Button size="sm" onClick={() => analyze.mutate({ sinceDays: Math.max(30, days) })} loading={analyze.isPending}>
          {analyze.isPending ? null : <Sparkles />} Analyse pending ({formatNumber(coverage.pending)})
        </Button>
      </Tip>
    ) : null;

  return (
    <div className={cn("flex flex-col gap-4 px-7 pb-8 transition-opacity", isFetching && isPlaceholderData && "opacity-60")}>
      <InsightPaletteStyle />

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 max-w-2xl">
          <h2 className="font-heading text-[22px] leading-tight">Conversation Insights</h2>
          <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
            Every call is read by AI and classified into a living taxonomy of at most {cap} tags. Tags merge as patterns converge, so counts stay comparable over time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {rangeControl}
          {dataUpdatedAt ? <span className="hidden text-xs text-muted-foreground lg:inline">Updated {relativeTime(new Date(dataUpdatedAt))}</span> : null}
          <Tip label="Refresh">
            <Button variant="outline" size="icon-sm" onClick={() => refetch()} aria-label="Refresh insights" disabled={isFetching}>
              <RefreshCw className={cn(isFetching && "animate-spin")} />
            </Button>
          </Tip>
          <CoveragePill coverage={coverage} />
          {analyseButton}
        </div>
      </div>

      {!coverage.configured ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-[13.5px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200" role="status">
          <KeyRound className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
          <div>
            <span className="font-medium">Insights are not enabled.</span> Add <code className="rounded bg-amber-900/10 px-1 py-px font-mono text-[12.5px] dark:bg-amber-200/10">OPENAI_API_KEY</code> to <code className="rounded bg-amber-900/10 px-1 py-px font-mono text-[12.5px] dark:bg-amber-200/10">backend/.env</code> to enable insights. Once set, every completed call is analysed automatically and earlier calls can be back-filled with “Analyse pending”.
          </div>
        </div>
      ) : null}

      {!analysed ? (
        <Card className="border-dashed">
          <EmptyState
            icon={Sparkles}
            title="No analysed calls in this period"
            description={
              !coverage.configured
                ? "Configure OpenAI on the backend to start reading calls. The taxonomy, sentiment and risk views will fill in as calls are analysed."
                : coverage.pending > 0
                  ? `${formatNumber(coverage.pending)} completed call${coverage.pending === 1 ? " is" : "s are"} waiting to be analysed. Run the analysis to build the taxonomy.`
                  : `Completed calls from the last ${days} days are read and tagged automatically within a minute of ending.`
            }
            className="py-10"
            action={
              <div className="flex items-center gap-2">
                {analyseButton}
                <Link href="/conversations" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Open conversations
                </Link>
              </div>
            }
          />
        </Card>
      ) : null}

      <div className="grid grid-cols-12 gap-4">
        <TaxonomyPanel className="col-span-12 self-start xl:sticky xl:top-4 xl:col-span-5" taxonomy={taxonomy} cap={cap} trends={data.trends} selectedKey={selectedKey} onSelect={(k) => selectTag(k)} />

        <div className="col-span-12 grid grid-cols-1 gap-4 md:grid-cols-2 xl:col-span-7">
          <ChartCard className="md:col-span-2" title="Tag trends" subtitle="Tagged calls per day · top 8 tags">
            <TagTrends trends={data.trends} taxonomy={taxonomy} selectedKey={sheetOpen ? undefined : selectedKey} onSelect={(k) => setSelectedKey(k)} />
          </ChartCard>
          <ChartCard title="Caller sentiment" subtitle="How leads felt, as read from the transcript">
            <SentimentDonut distribution={data.sentiment.distribution} trend={data.sentiment.trend} enabled={analysed} />
          </ChartCard>
          <ChartCard title="Loss risk" subtitle="Probability each lead is lost, in four bands" bodyClassName="flex flex-col">
            <LossRiskBars lossRisk={data.lossRisk} enabled={analysed} />
          </ChartCard>
          <ChartCard title="Top objections" subtitle="Most frequent pushbacks from leads">
            <HorizontalBars data={data.objections} color={COLORS.c6} valueName="Calls" emptyText="No objections recorded" />
          </ChartCard>
          <ChartCard title="Recommended next actions" subtitle="What the AI suggests the team does next">
            <NextActionsList actions={data.nextActions} />
          </ChartCard>
          <ChartCard className="md:col-span-2" title="Taxonomy activity" subtitle="Tags merged as patterns converged, newest first">
            <MergeTimeline merges={data.merges} taxonomy={taxonomy} onSelect={(k) => selectTag(k)} />
          </ChartCard>
        </div>
      </div>

      <ChartCard
        title="Recent analysed calls"
        subtitle="Latest calls with AI insights in this period"
        right={
          <Link href="/conversations" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            All conversations
          </Link>
        }
      >
        <RecentCalls recent={data.recent} taxonomy={taxonomy} />
      </ChartCard>

      <TagDetailSheet tag={selected} open={sheetOpen} onOpenChange={(o) => (o ? setSheetOpen(true) : selectTag(undefined))} taxonomy={taxonomy} trends={data.trends} days={days} />
    </div>
  );
}
