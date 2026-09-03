"use client";
import { useMemo } from "react";
import { ChevronLeft, ChevronRight, CircleAlert, ListFilter, Loader2, Phone, PhoneCall, PhoneIncoming, PhoneOutgoing, User } from "lucide-react";
import { SentimentDot, TagChip } from "@/components/analytics/insights/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useInsightTags } from "@/hooks/api";
import type { Conversation } from "@/lib/types";
import { cn, formatDuration, formatNumber, initials, relativeTime } from "@/lib/utils";
import { displayName, isLive, outcomeMeta } from "./helpers";

export function Avatar({ c, className }: { c: Pick<Conversation, "leadName" | "phone" | "status">; className?: string }) {
  const live = isLive(c.status);
  return (
    <div className={cn("relative shrink-0", className)}>
      <div className="flex size-full items-center justify-center rounded-full bg-accent-tint font-heading text-[13px] text-primary-hover">
        {c.leadName ? initials(c.leadName) : c.phone ? <Phone className="size-4" strokeWidth={1.8} /> : <User className="size-4" strokeWidth={1.8} />}
      </div>
      {live ? (
        <span className="absolute -bottom-0.5 -right-0.5 flex size-3 items-center justify-center">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex size-2 rounded-full border-2 border-card bg-primary" />
        </span>
      ) : null}
    </div>
  );
}

function Row({ c, active, onSelect, tagColors }: { c: Conversation; active: boolean; onSelect: (id: string) => void; tagColors: Map<string, number> }) {
  const outcome = outcomeMeta(c.callSuccessful);
  const live = isLive(c.status);
  const tags = c.insights?.tags ?? [];
  const Direction = c.direction === "inbound" ? PhoneIncoming : PhoneOutgoing;
  const secondary = c.summaryTitle || c.summary || (live ? "Call in progress…" : c.status === "processing" ? "Processing transcript…" : c.status === "failed" ? "Call failed" : "No summary yet");
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(c._id)}
        aria-current={active ? "true" : undefined}
        className={cn(
          "flex w-full items-start gap-3 border-l-2 px-4 py-3 text-left transition-colors",
          active ? "border-l-primary bg-accent-tint/50" : "border-l-transparent hover:bg-muted/50"
        )}
      >
        <Avatar c={c} className="mt-0.5 size-9" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[14px] font-medium leading-5">{displayName(c)}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground">{relativeTime(c.startedAt || c.createdAt)}</span>
          </div>
          <p className={cn("mt-0.5 line-clamp-1 text-[13px]", c.summaryTitle || c.summary ? "text-muted-foreground" : "text-muted-foreground/70 italic")}>{secondary}</p>
          {tags.length ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <SentimentDot sentiment={c.insights?.sentiment} className="mr-0.5 size-1.5" />
              {tags.slice(0, 3).map((t) => (
                <TagChip key={t.key} label={t.label} color={tagColors.get(t.key) ?? null} size="xs" />
              ))}
              {tags.length > 3 ? <span className="shrink-0 text-[10.5px] text-muted-foreground">+{tags.length - 3}</span> : null}
            </div>
          ) : null}
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1 truncate text-[11.5px] text-muted-foreground">
              <span className="truncate">{c.agentName || "Agent"}</span>
              <span aria-hidden>·</span>
              <span className="shrink-0 tabular-nums">{formatDuration(c.durationSecs)}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {live ? (
                <Badge variant="info">Live</Badge>
              ) : c.status === "processing" ? (
                <Badge variant="warning">Processing</Badge>
              ) : (
                <Badge variant={outcome.variant}>{outcome.label}</Badge>
              )}
              {c.direction ? (
                <Direction className="size-3.5 text-muted-foreground" strokeWidth={1.8} aria-label={c.direction} />
              ) : (
                <PhoneCall className="size-3.5 text-muted-foreground" strokeWidth={1.8} />
              )}
            </span>
          </div>
        </div>
      </button>
    </li>
  );
}

export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-border/60">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-start gap-3 px-4 py-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ConversationList({
  items,
  total,
  page,
  pages,
  selectedId,
  onSelect,
  onPage,
  loading,
  fetching,
  error,
  onRetry,
  hasFilters,
  onClearFilters,
  emptyTitle,
  emptyDescription,
}: {
  items: Conversation[];
  total: number;
  page: number;
  pages: number;
  selectedId?: string;
  onSelect: (id: string) => void;
  onPage: (page: number) => void;
  loading: boolean;
  fetching: boolean;
  error?: string | null;
  onRetry: () => void;
  hasFilters: boolean;
  onClearFilters: () => void;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const { data: tagDefs } = useInsightTags();
  const tagColors = useMemo(() => new Map((tagDefs ?? []).map((t) => [t.key, t.color])), [tagDefs]);
  return (
    <>
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4 text-[12.5px] text-muted-foreground">
        <span>{loading ? "Loading…" : `${formatNumber(total)} conversation${total === 1 ? "" : "s"}`}</span>
        {fetching && !loading ? <Loader2 className="size-3.5 animate-spin" aria-label="Refreshing" /> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <ListSkeleton />
        ) : error ? (
          <EmptyState
            icon={CircleAlert}
            title="Couldn't load conversations"
            description={error}
            className="py-12"
            action={
              <Button variant="outline" size="sm" onClick={onRetry}>
                Retry
              </Button>
            }
          />
        ) : items.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={ListFilter}
              title="No matches"
              description="Nothing matches the current search or filters."
              className="py-12"
              action={
                <Button variant="outline" size="sm" onClick={onClearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState icon={PhoneCall} title={emptyTitle} description={emptyDescription} className="py-12" />
          )
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((c) => (
              <Row key={c._id} c={c} active={c._id === selectedId} onSelect={onSelect} tagColors={tagColors} />
            ))}
          </ul>
        )}
      </div>
      {pages > 1 ? (
        <div className="flex h-11 shrink-0 items-center justify-between border-t border-border px-2">
          <Button variant="ghost" size="xs" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <ChevronLeft /> Prev
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Button variant="ghost" size="xs" disabled={page >= pages} onClick={() => onPage(page + 1)}>
            Next <ChevronRight />
          </Button>
        </div>
      ) : null}
    </>
  );
}
