"use client";
import { useMemo } from "react";
import Link from "next/link";
import { BarChart3, CircleAlert, Table2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { useAnalytics } from "@/hooks/api";
import { errorMessage } from "@/lib/api";
import { cn, formatDuration, formatNumber, titleCase } from "@/lib/utils";
import { ChartCard } from "./ChartCard";
import { MetricCard } from "./MetricCard";
import { COLORS, fmtDay } from "./chart-theme";
import { AgentTable } from "./charts/AgentTable";
import { CallsPerDay, type DayRow } from "./charts/CallsPerDay";
import { DirectionBar } from "./charts/DirectionBar";
import { Heatmap } from "./charts/Heatmap";
import { HorizontalBars } from "./charts/HorizontalBars";
import { LeadFunnel } from "./charts/LeadFunnel";
import { MinutesPerDay } from "./charts/MinutesPerDay";
import { OutcomesDonut } from "./charts/OutcomesDonut";

export type RangeKey = "7" | "30" | "90";

export function AnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-7 pb-8">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-7 w-16" />
            <Skeleton className="mt-4 h-9 w-full" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-2 h-3 w-48" />
            <Skeleton className="mt-5 h-[220px] w-full" />
          </Card>
        ))}
      </div>
    </div>
  );
}

/** The original call-volume dashboard (Calls tab). Query state is owned by `AnalyticsPage` so the header can show refresh/updated. */
export function CallsDashboard({ query, days, range, setRange }: { query: ReturnType<typeof useAnalytics>; days: number; range: RangeKey; setRange: (r: RangeKey) => void }) {
  const { data, isLoading, isError, error, isFetching, refetch, isPlaceholderData } = query;

  const trends: DayRow[] = useMemo(
    () =>
      (data?.trends ?? []).map((t) => ({
        ...t,
        label: fmtDay(t.date),
        other: Math.max(0, t.calls - t.success - t.failed),
      })),
    [data]
  );

  const period = `previous ${days} days`;
  const s = data?.summary;

  if (isLoading) return <AnalyticsSkeleton />;
  if (isError || !data || !s) {
    return (
      <div className="px-7 pb-8">
        <Card>
          <EmptyState
            icon={CircleAlert}
            title="Couldn't load analytics"
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

  return (
    <div className={cn("flex flex-col gap-4 px-7 pb-8 transition-opacity", isFetching && isPlaceholderData && "opacity-60")}>
      {s.calls === 0 ? (
        <Card className="border-dashed">
          <EmptyState
            icon={BarChart3}
            title="No calls in this period yet"
            description={`Nothing was recorded in the last ${days} days. Place a call from My Leads or the AI Test page and it will show up here within a minute.`}
            className="py-10"
            action={
              <div className="flex items-center gap-2">
                <Link href="/leads" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <Table2 /> Go to My Leads
                </Link>
                {range !== "90" ? (
                  <Button variant="ghost" size="sm" onClick={() => setRange("90")}>
                    Widen to 90 days
                  </Button>
                ) : null}
              </div>
            }
          />
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Calls" value={formatNumber(s.calls)} delta={{ current: s.calls, previous: s.previous.calls, period }} sub={`${formatNumber(s.completed)} completed`} spark={trends.map((t) => t.calls)} />
        <MetricCard label="Call minutes" value={formatNumber(Math.round(s.minutes))} delta={{ current: s.minutes, previous: s.previous.minutes, period }} sub={`${formatNumber(s.previous.minutes)} min previously`} spark={trends.map((t) => t.minutes)} />
        <MetricCard label="Success rate" value={`${s.successRate}%`} sub={`${formatNumber(s.successCount)} successful · ${formatNumber(s.failureCount)} failed`} spark={trends.map((t) => t.success)} />
        <MetricCard label="Avg duration" value={formatDuration(s.avgDurationSecs)} sub="per completed call" spark={trends.map((t) => (t.calls ? (t.minutes * 60) / t.calls : 0))} />
        <MetricCard label="Leads updated" value={formatNumber(s.leadsUpdated)} sub={`of ${formatNumber(s.leadsCalled)} called`} />
        <MetricCard label="Zoho pushes" value={formatNumber(s.zohoPushed)} sub={s.zohoPushed ? "calls synced to CRM" : "no CRM pushes yet"} />
      </div>

      <div className="grid grid-cols-6 gap-4">
        <ChartCard className="col-span-6 xl:col-span-3" title="Calls per day" subtitle="Stacked by outcome">
          <CallsPerDay data={trends} />
        </ChartCard>
        <ChartCard className="col-span-6 xl:col-span-3" title="Minutes per day" subtitle="Total talk time">
          <MinutesPerDay data={trends} />
        </ChartCard>

        <ChartCard className="col-span-6 xl:col-span-3" title="Outcomes" subtitle="Call result as judged by the agent">
          <OutcomesDonut result={data.outcomes.result} />
        </ChartCard>
        <ChartCard className="col-span-6 xl:col-span-3" title="Direction" subtitle="Inbound vs outbound calls" bodyClassName="flex flex-col">
          <DirectionBar direction={data.outcomes.direction} />
        </ChartCard>

        <ChartCard className="col-span-6" title="Agent performance" subtitle="Ranked by call volume in this period">
          <AgentTable agents={data.agents} />
        </ChartCard>

        <ChartCard className="col-span-6 md:col-span-3 xl:col-span-2" title="Lead funnel" subtitle="Coverage across all leads" bodyClassName="flex flex-col">
          <LeadFunnel leads={data.leads} />
        </ChartCard>
        <ChartCard className="col-span-6 md:col-span-3 xl:col-span-2" title="Leads by status" subtitle="Top statuses in your CRM">
          <HorizontalBars data={data.leads.byStatus.map((b) => ({ name: b.name === "—" ? "No status" : b.name, value: b.value }))} color={COLORS.c2} valueName="Leads" emptyText="No leads yet" />
        </ChartCard>
        <ChartCard className="col-span-6 xl:col-span-2" title="Termination reasons" subtitle="Why calls ended">
          <HorizontalBars data={data.outcomes.termination.map((t) => ({ name: titleCase(t.name) || "Unknown", value: t.value }))} emptyText="No calls in this period" />
        </ChartCard>

        <ChartCard className="col-span-6" title="Call activity heatmap" subtitle={`Calls by weekday and hour (${data.timezone ?? "UTC"})`}>
          <Heatmap heatmap={data.heatmap} />
        </ChartCard>
      </div>
    </div>
  );
}
