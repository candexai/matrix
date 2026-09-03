"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BarChart3, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tip } from "@/components/ui/tooltip";
import { useAnalytics } from "@/hooks/api";
import { cn, relativeTime } from "@/lib/utils";
import { AnalyticsSkeleton, CallsDashboard, type RangeKey } from "./CallsDashboard";
import { InsightsPage } from "./insights/InsightsPage";

type TabKey = "calls" | "insights";
const RANGES = [
  { value: "7" as const, label: "7d" },
  { value: "30" as const, label: "30d" },
  { value: "90" as const, label: "90d" },
];

/** Suspense fallback for the route (the page reads `useSearchParams`). */
export function AnalyticsPageSkeleton() {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Analytics" description="Call volume, outcomes and lead coverage across your voice agents.">
        <Skeleton className="h-10 w-56 rounded-lg" />
      </PageHeader>
      <AnalyticsSkeleton />
    </div>
  );
}

export function AnalyticsPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab: TabKey = sp.get("tab") === "insights" ? "insights" : "calls";
  const [range, setRange] = useState<RangeKey>("30");
  const days = Number(range);
  const query = useAnalytics({ days });
  const { isFetching, refetch, dataUpdatedAt } = query;

  const setTab = useCallback(
    (next: TabKey) => {
      const params = new URLSearchParams(sp.toString());
      if (next === "calls") params.delete("tab");
      else params.set("tab", next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [sp, router, pathname]
  );

  // Re-render the "Updated …" caption every 30s.
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const updated = dataUpdatedAt ? relativeTime(new Date(dataUpdatedAt)) : null;
  const rangeControl = <Segmented<RangeKey> value={range} onChange={setRange} options={RANGES} />;

  return (
    <div className="flex flex-1 flex-col">
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="flex flex-1 flex-col">
        <PageHeader
          title="Analytics"
          description={tab === "insights" ? "What leads say, feel and object to — read by AI from every call." : "Call volume, outcomes and lead coverage across your voice agents."}
          actions={
            tab === "calls" ? (
              <div className="flex items-center gap-3">
                {updated ? <span className="hidden text-xs text-muted-foreground sm:inline">Updated {updated}</span> : null}
                <Tip label="Refresh">
                  <Button variant="outline" size="icon-sm" onClick={() => refetch()} aria-label="Refresh analytics" disabled={isFetching}>
                    <RefreshCw className={cn(isFetching && "animate-spin")} />
                  </Button>
                </Tip>
                {rangeControl}
              </div>
            ) : null
          }
        >
          <TabsList>
            <TabsTrigger value="calls">
              <BarChart3 /> Calls
            </TabsTrigger>
            <TabsTrigger value="insights">
              <Sparkles /> Insights
            </TabsTrigger>
          </TabsList>
        </PageHeader>

        <TabsContent value="calls" className="mt-0">
          <CallsDashboard query={query} days={days} range={range} setRange={setRange} />
        </TabsContent>
        <TabsContent value="insights" className="mt-0">
          <InsightsPage days={days} rangeControl={rangeControl} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
