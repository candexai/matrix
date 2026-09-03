"use client";
import Link from "next/link";
import { ArrowRight, AudioWaveform, Columns3, Layers, MoreHorizontal, Pencil, RefreshCw, Settings2, Sparkles, Table2, Trash2, PanelRightOpen } from "lucide-react";
import type { LeadList, LeadListBindingSummary } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { categoryLabel, formatCount } from "./leadUtils";

export interface LeadListCardProps {
  list: LeadList;
  /** Workspace default binding — decides between "No agent — uses default" and "No agent". */
  defaultBinding?: LeadListBindingSummary | null;
  onAttach: (list: LeadList) => void;
  /** Opens the "Generate agent with AI" wizard for this table. */
  onGenerate?: (list: LeadList) => void;
  onRename?: (list: LeadList) => void;
  onDelete?: (list: LeadList) => void;
}

/** One lead table in the My Leads overview grid. The whole card links to `/leads/<id>`. */
export function LeadListCard({ list, defaultBinding, onAttach, onGenerate, onRename, onDelete }: LeadListCardProps) {
  const href = `/leads/${list._id}`;
  const isAll = list.source === "all";
  const isZoho = list.source === "zoho";
  const isManual = list.source === "manual";
  const Icon = isAll ? Layers : Table2;
  const binding = list.binding ?? null;
  const category = isZoho ? categoryLabel(list.category) : "";
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div className={cn("group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-xs transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-md", isAll && "border-primary/25 bg-accent-tint/20")}>
      <Link href={href} className="absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50" aria-label={`Open ${list.name}`} />

      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors group-hover:text-primary", isAll && "bg-primary text-primary-foreground group-hover:text-primary-foreground")}>
            <Icon className="size-4" strokeWidth={1.7} />
          </span>
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {isAll ? <Badge variant="soft">Every lead</Badge> : null}
            {isZoho ? <Badge variant="soft">Zoho view</Badge> : null}
            {isManual ? <Badge variant="outline">Manual</Badge> : null}
            {category ? <Badge variant="outline">{category}</Badge> : null}
            {list.isDefault ? <Badge variant="secondary">Default</Badge> : null}
          </div>
        </div>
        <div className="relative z-10 -mr-2 -mt-2" onClick={stop}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${list.name}`} className="text-muted-foreground opacity-60 group-hover:opacity-100 data-[state=open]:opacity-100">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={href}>
                  <PanelRightOpen /> Open
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAttach(list)}>
                {binding && !binding.inherited ? <Settings2 /> : <AudioWaveform />}
                {binding && !binding.inherited ? (isAll ? "Configure default agent" : "Configure agent") : isAll ? "Attach default agent" : "Attach agent"}
              </DropdownMenuItem>
              {onGenerate ? (
                <DropdownMenuItem onSelect={() => onGenerate(list)}>
                  <Sparkles /> Generate agent with AI
                </DropdownMenuItem>
              ) : null}
              {isManual && (onRename || onDelete) ? <DropdownMenuSeparator /> : null}
              {isManual && onRename ? (
                <DropdownMenuItem onSelect={() => onRename(list)}>
                  <Pencil /> Rename
                </DropdownMenuItem>
              ) : null}
              {isManual && onDelete ? (
                <DropdownMenuItem destructive onSelect={() => onDelete(list)}>
                  <Trash2 /> Delete
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="min-w-0">
        <h3 className="truncate font-heading text-[18px] leading-tight" title={list.name}>
          {list.name}
        </h3>
        <div className="mt-1.5 flex items-baseline gap-1.5">
          <span className="font-heading text-[34px] leading-none tabular-nums">{formatCount(list.recordCount ?? 0)}</span>
          <span className="text-[13px] text-muted-foreground">lead{list.recordCount === 1 ? "" : "s"}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Columns3 className="size-3.5" />
          {isAll ? "Default columns" : `${list.columns?.length ?? 0} column${list.columns?.length === 1 ? "" : "s"}`}
        </span>
        {isZoho ? (
          <span className="inline-flex items-center gap-1">
            <RefreshCw className="size-3.5" />
            {list.lastSyncAt ? `Synced ${relativeTime(list.lastSyncAt)}` : "Not synced yet"}
          </span>
        ) : isManual && list.updatedAt ? (
          <span>Updated {relativeTime(list.updatedAt)}</span>
        ) : null}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
        <span className={cn("flex min-w-0 items-center gap-1.5 text-[13px]", binding ? "text-foreground" : "text-muted-foreground")}>
          <AudioWaveform className={cn("size-3.5 shrink-0", binding ? "text-primary" : "text-muted-foreground")} strokeWidth={1.8} />
          {binding ? (
            <span className="truncate">
              <span className="text-muted-foreground">Agent:</span> {binding.agentName ?? "Voice agent"}
              {binding.inherited ? <span className="text-muted-foreground"> (inherited)</span> : null}
            </span>
          ) : (
            <span className="truncate">{isAll ? "No default agent" : defaultBinding ? "No agent — uses default" : "No agent"}</span>
          )}
        </span>
        <span className="pointer-events-none inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          Open <ArrowRight className="size-3.5" />
        </span>
      </div>
    </div>
  );
}

export function LeadListCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="flex items-center gap-2.5">
        <div className="size-9 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-20 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="h-5 w-40 animate-pulse rounded bg-muted" />
      <div className="h-8 w-16 animate-pulse rounded bg-muted" />
      <div className="h-3.5 w-48 animate-pulse rounded bg-muted" />
      <div className="mt-1 h-4 w-32 animate-pulse rounded bg-muted" />
    </div>
  );
}
