"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MessageSquare, RefreshCw, Search, Table2, Tag, UserRound, X } from "lucide-react";
import { InsightPaletteStyle } from "@/components/analytics/insights/InsightPaletteStyle";
import { SentimentDot, TagDot } from "@/components/analytics/insights/primitives";
import { SENTIMENTS, SENTIMENT_ORDER } from "@/components/analytics/insightColors";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tip } from "@/components/ui/tooltip";
import { useAgents, useConversations, useInsightTags, useSyncConversations, type ConversationFilters } from "@/hooks/api";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CHANNELS, channelMeta, type Channel } from "./channels";
import { ConversationDetail } from "./ConversationDetail";
import { ConversationList, ListSkeleton } from "./ConversationList";
import { useDebouncedValue } from "./helpers";

type Range = "7d" | "30d" | "90d" | "all";
const RANGE_DAYS: Record<Range, number | null> = { "7d": 7, "30d": 30, "90d": 90, all: null };
const RANGE_OPTIONS = [
  { value: "7d" as const, label: "7d" },
  { value: "30d" as const, label: "30d" },
  { value: "90d" as const, label: "90d" },
  { value: "all" as const, label: "All time" },
];
const OUTCOMES = [
  { value: "any", label: "Any outcome" },
  { value: "success", label: "Success" },
  { value: "failure", label: "Failed" },
  { value: "unknown", label: "Unknown" },
];
const STATUSES = [
  { value: "any", label: "Any status" },
  { value: "done", label: "Completed" },
  { value: "in_progress", label: "Live" },
  { value: "initiated", label: "Ringing" },
  { value: "processing", label: "Processing" },
  { value: "failed", label: "Failed" },
];

const PAGE_HEIGHT = "h-[calc(100svh-72px)] min-h-[640px]";

export function ConversationsPageSkeleton() {
  return (
    <div className={cn("flex flex-1 flex-col", PAGE_HEIGHT)}>
      <PageHeader title="Conversations" description="View and reply across channels.">
        <Skeleton className="h-10 w-[560px] max-w-full rounded-lg" />
        <Skeleton className="h-9 w-full rounded-md" />
      </PageHeader>
      <div className="flex min-h-0 flex-1 px-7 pb-6">
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card">
          <aside className="w-[380px] shrink-0 border-r border-border">
            <ListSkeleton />
          </aside>
          <div className="flex-1" />
        </div>
      </div>
    </div>
  );
}

export function ConversationsPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const selectedId = sp.get("id") ?? undefined;
  const leadId = sp.get("leadId") ?? undefined;
  const tag = sp.get("tag") ?? undefined;

  const [channel, setChannel] = useState<Channel>("all");
  const [search, setSearch] = useState("");
  const [agentId, setAgentId] = useState("any");
  const [outcome, setOutcome] = useState("any");
  const [status, setStatus] = useState("any");
  const [sentiment, setSentiment] = useState("any");
  const [range, setRange] = useState<Range>("all");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  const from = useMemo(() => {
    const days = RANGE_DAYS[range];
    return days ? new Date(Date.now() - days * 86_400_000).toISOString() : undefined;
  }, [range]);

  // Any filter change goes back to page 1.
  useEffect(() => setPage(1), [channel, debouncedSearch, agentId, outcome, status, sentiment, range, leadId, tag]);

  const filters: ConversationFilters & { sentiment?: string } = {
    channel: channel === "all" ? undefined : channel,
    search: debouncedSearch || undefined,
    agentId: agentId === "any" ? undefined : agentId,
    outcome: outcome === "any" ? undefined : outcome,
    status: status === "any" ? undefined : status,
    sentiment: sentiment === "any" ? undefined : sentiment,
    tag,
    from,
    leadId,
    page,
    limit: 30,
  };
  const { data, isLoading, isFetching, isError, error, refetch } = useConversations(filters);
  const { data: agents } = useAgents();
  const { data: tagDefs } = useInsightTags();
  const activeTags = useMemo(() => (tagDefs ?? []).filter((t) => t.status === "active").sort((a, b) => b.count - a.count), [tagDefs]);
  const tagDef = tag ? tagDefs?.find((t) => t.key === tag) : undefined;
  const sync = useSyncConversations();

  const items = useMemo(() => data?.items ?? [], [data]);
  const counts = data?.channelCounts ?? {};
  const allCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const hasFilters = Boolean(debouncedSearch || agentId !== "any" || outcome !== "any" || status !== "any" || sentiment !== "any" || range !== "all" || leadId || tag);
  const workspaceEmpty = !isLoading && !isError && allCount === 0 && items.length === 0 && !hasFilters && channel === "all";
  const channelEmpty = !isLoading && !isError && channel !== "all" && channel !== "voice" && items.length === 0 && !hasFilters;

  const setParam = useCallback(
    (key: string, value?: string) => {
      const next = new URLSearchParams(sp.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [sp, router, pathname]
  );

  // Auto-select the first conversation when nothing is selected.
  useEffect(() => {
    if (!selectedId && items.length > 0) setParam("id", items[0]._id);
  }, [selectedId, items, setParam]);

  const onDeleted = (id: string) => {
    const next = items.find((c) => c._id !== id);
    setParam("id", next?._id);
  };
  const clearFilters = () => {
    setSearch("");
    setAgentId("any");
    setOutcome("any");
    setStatus("any");
    setSentiment("any");
    setRange("all");
    if (leadId) setParam("leadId", undefined);
    if (tag) setParam("tag", undefined);
  };

  const leadLabel = leadId ? items.find((c) => c.leadId === leadId)?.leadName : undefined;
  const syncButton = (
    <Tip label="Pull recent calls from ElevenLabs when the post-call webhook can't reach this server">
      <Button variant="secondary" onClick={() => sync.mutate({})} loading={sync.isPending}>
        {sync.isPending ? null : <RefreshCw />} Sync from ElevenLabs
      </Button>
    </Tip>
  );

  return (
    <div className={cn("flex flex-1 flex-col", PAGE_HEIGHT)}>
      <InsightPaletteStyle />
      <PageHeader title="Conversations" description="View and reply across channels." actions={syncButton}>
        <Segmented<Channel>
          value={channel}
          onChange={setChannel}
          options={CHANNELS.map((c) => {
            const n = c.value === "all" ? allCount : counts[c.value] ?? 0;
            return { value: c.value, label: c.label, icon: c.icon, count: c.value === "all" || n > 0 ? n : undefined };
          })}
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-72 max-w-full">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone, summary or transcript" className="pl-8 pr-8" aria-label="Search conversations" />
            {search ? (
              <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Clear search">
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger className="w-[180px]" aria-label="Agent">
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">All agents</SelectItem>
              {agents?.map((a) => (
                <SelectItem key={a._id} value={a.elevenAgentId}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={outcome} onValueChange={setOutcome}>
            <SelectTrigger className="w-[150px]" aria-label="Outcome">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OUTCOMES.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[150px]" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tag ?? "any"} onValueChange={(v) => setParam("tag", v === "any" ? undefined : v)}>
            <SelectTrigger className="w-[190px]" aria-label="Tag">
              <SelectValue placeholder="Any tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any tag</SelectItem>
              {activeTags.map((t) => (
                <SelectItem key={t.key} value={t.key}>
                  <span className="inline-flex items-center gap-2">
                    <TagDot color={t.color} /> {t.label}
                    <span className="text-xs tabular-nums text-muted-foreground">{t.count}</span>
                  </span>
                </SelectItem>
              ))}
              {tag && !activeTags.some((t) => t.key === tag) ? (
                <SelectItem value={tag}>
                  <span className="inline-flex items-center gap-2">
                    <TagDot color={tagDef?.color ?? null} /> {tagDef?.label ?? tag}
                  </span>
                </SelectItem>
              ) : null}
            </SelectContent>
          </Select>
          <Select value={sentiment} onValueChange={setSentiment}>
            <SelectTrigger className="w-[150px]" aria-label="Sentiment">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any sentiment</SelectItem>
              {SENTIMENT_ORDER.map((k) => (
                <SelectItem key={k} value={k}>
                  <span className="inline-flex items-center gap-2">
                    <SentimentDot sentiment={k} /> {SENTIMENTS[k].label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {tag ? (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-md border border-primary/40 bg-accent-tint/60 pl-2.5 pr-1.5 text-[13px] text-primary-hover">
              <Tag className="size-3.5" /> Tag: {tagDef?.label ?? tag}
              <button type="button" onClick={() => setParam("tag", undefined)} className="rounded p-0.5 hover:bg-primary/15" aria-label="Remove tag filter">
                <X className="size-3.5" />
              </button>
            </span>
          ) : null}
          {leadId ? (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-md border border-primary/40 bg-accent-tint/60 pl-2.5 pr-1.5 text-[13px] text-primary-hover">
              <UserRound className="size-3.5" /> Filtered by lead{leadLabel ? `: ${leadLabel}` : ""}
              <button type="button" onClick={() => setParam("leadId", undefined)} className="rounded p-0.5 hover:bg-primary/15" aria-label="Remove lead filter">
                <X className="size-3.5" />
              </button>
            </span>
          ) : null}
          <div className="ml-auto">
            <Segmented<Range> value={range} onChange={setRange} options={RANGE_OPTIONS} />
          </div>
        </div>
      </PageHeader>

      <div className="flex min-h-0 flex-1 flex-col px-7 pb-6">
        {workspaceEmpty ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-card">
            <EmptyState
              icon={Search}
              title="No conversations"
              description="Calls placed from My Leads or the AI Test page will appear here."
              action={
                <div className="flex items-center gap-2">
                  {syncButton}
                  <Link href="/leads" className={buttonVariants({})}>
                    <Table2 /> Go to My Leads
                  </Link>
                </div>
              }
            />
          </div>
        ) : channelEmpty ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-card">
            <EmptyState
              icon={channelMeta(channel).icon}
              title={`No ${channelMeta(channel).label} conversations yet`}
              description={`Connect ${channelMeta(channel).label} in Integrations to start receiving messages here.`}
              action={
                <Link href="/integrations" className={buttonVariants({ variant: "outline" })}>
                  Connect {channelMeta(channel).label}
                </Link>
              }
            />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card">
            <aside className="flex w-[380px] shrink-0 flex-col border-r border-border">
              <ConversationList
                items={items}
                total={data?.total ?? 0}
                page={data?.page ?? page}
                pages={data?.pages ?? 0}
                selectedId={selectedId}
                onSelect={(id) => setParam("id", id)}
                onPage={setPage}
                loading={isLoading}
                fetching={isFetching}
                error={isError ? errorMessage(error) : null}
                onRetry={() => refetch()}
                hasFilters={hasFilters}
                onClearFilters={clearFilters}
                emptyTitle={channel === "voice" ? "No voice conversations yet" : "No conversations"}
                emptyDescription="Calls placed from My Leads or the AI Test page will appear here."
              />
            </aside>
            <section className="flex min-w-0 flex-1 flex-col">
              {selectedId ? (
                <ConversationDetail key={selectedId} id={selectedId} onDeleted={onDeleted} />
              ) : (
                <div className="flex flex-1 items-center justify-center">
                  <EmptyState icon={MessageSquare} title="Select a conversation" description="Pick a call on the left to see its recording, transcript and collected data." />
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
