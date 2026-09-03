"use client";
import { ExternalLink, MoreHorizontal, PhoneCall, Trash2, PanelRightOpen, ListX } from "lucide-react";
import type { Lead } from "@/lib/types";
import { cn, initials, relativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tip } from "@/components/ui/tooltip";
import { callStatusVariant, FIXED_LEAD_COLUMNS, formatFieldValue, isEmptyValue, isNumericType, leadFieldValue, outcomeLabel, outcomeVariant, sourceLabel, statusVariant, zohoLeadUrl } from "./leadUtils";

/** A Zoho custom-view column (from `LeadListDetail.resolvedColumns`). */
export interface ViewColumn {
  api_name: string;
  label: string;
  data_type: string;
  /** true when the column is part of the Zoho view definition */
  inView?: boolean;
}

export interface LeadsTableProps {
  leads: Lead[];
  loading?: boolean;
  skeletonRows?: number;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onOpen: (lead: Lead) => void;
  onCall: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  /** Manual lists only: offer "Remove from list" on each row. */
  onRemoveFromList?: (lead: Lead) => void;
  accountsUrl?: string | null;
  canCall: boolean;
  /** Zoho view columns. When omitted the default columns (Email / Status / City / Source) are shown. */
  columns?: ViewColumn[];
}

const VIEW_COL_WIDTH = 150;
const BASE_WIDTH = 1020;

export function LeadsTable({ leads, loading, skeletonRows = 10, selected, onToggle, onToggleAll, onOpen, onCall, onDelete, onRemoveFromList, accountsUrl, canCall, columns }: LeadsTableProps) {
  const pageIds = leads.map((l) => l._id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someSelected = !allSelected && pageIds.some((id) => selected.has(id));

  // Name / Phone / Email are always present, so drop view columns that duplicate them.
  const viewCols = columns ? dedupe(columns).filter((c) => !FIXED_LEAD_COLUMNS.has(c.api_name)) : null;
  const midCount = viewCols ? viewCols.length : 3; // Status / City / Source in default mode
  const minWidth = viewCols ? BASE_WIDTH + viewCols.length * VIEW_COL_WIDTH : 1080;
  const skeletonCols = 1 /* email */ + midCount + 3; /* calls, last call, updated */

  return (
    <table className="w-full caption-bottom text-sm" style={{ minWidth }}>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-10 pl-4">
            <Checkbox checked={allSelected ? true : someSelected ? "indeterminate" : false} onCheckedChange={(c) => onToggleAll(c === true)} aria-label="Select all on page" disabled={!leads.length} />
          </TableHead>
          <TableHead className="min-w-[220px]">Name</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Email</TableHead>
          {viewCols ? (
            viewCols.map((c) => (
              <TableHead key={c.api_name} className={cn("whitespace-nowrap", isNumericType(c.data_type) && "text-right")} title={c.api_name}>
                {c.label}
              </TableHead>
            ))
          ) : (
            <>
              <TableHead>Status</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Source</TableHead>
            </>
          )}
          <TableHead className="text-right">Calls</TableHead>
          <TableHead>Last call</TableHead>
          <TableHead>Updated</TableHead>
          <TableHead className="w-20" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading
          ? Array.from({ length: skeletonRows }).map((_, i) => (
              <TableRow key={`s-${i}`} className="hover:bg-transparent">
                <TableCell className="pl-4">
                  <Skeleton className="size-4" />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-8 rounded-full" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-3.5 w-36" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3.5 w-28" />
                </TableCell>
                {Array.from({ length: skeletonCols }).map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-3.5 w-20" />
                  </TableCell>
                ))}
                <TableCell />
              </TableRow>
            ))
          : leads.map((lead) => <LeadRow key={lead._id} lead={lead} viewCols={viewCols} selected={selected.has(lead._id)} onToggle={onToggle} onOpen={onOpen} onCall={onCall} onDelete={onDelete} onRemoveFromList={onRemoveFromList} accountsUrl={accountsUrl} canCall={canCall} />)}
      </TableBody>
    </table>
  );
}

function dedupe(cols: ViewColumn[]): ViewColumn[] {
  const seen = new Set<string>();
  return cols.filter((c) => {
    if (!c.api_name || seen.has(c.api_name)) return false;
    seen.add(c.api_name);
    return true;
  });
}

function LeadRow({
  lead,
  viewCols,
  selected,
  onToggle,
  onOpen,
  onCall,
  onDelete,
  onRemoveFromList,
  accountsUrl,
  canCall,
}: {
  lead: Lead;
  viewCols: ViewColumn[] | null;
  selected: boolean;
  onToggle: (id: string) => void;
  onOpen: (l: Lead) => void;
  onCall: (l: Lead) => void;
  onDelete: (l: Lead) => void;
  onRemoveFromList?: (l: Lead) => void;
  accountsUrl?: string | null;
  canCall: boolean;
}) {
  const phone = lead.phone || lead.mobile;
  const zohoUrl = lead.zohoId ? zohoLeadUrl(lead.zohoId, accountsUrl) : null;
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const liveStatus = lead.lastCallStatus && !["done", "failed"].includes(lead.lastCallStatus) ? lead.lastCallStatus : null;

  return (
    <TableRow data-state={selected ? "selected" : undefined} onClick={() => onOpen(lead)} className="group cursor-pointer">
      <TableCell className="pl-4" onClick={stop}>
        <Checkbox checked={selected} onCheckedChange={() => onToggle(lead._id)} aria-label={`Select ${lead.fullName}`} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-tint text-[12px] font-medium text-primary-hover">{initials(lead.fullName)}</span>
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">{lead.fullName || "Unnamed lead"}</div>
            {lead.company ? <div className="truncate text-xs text-muted-foreground">{lead.company}</div> : lead.title ? <div className="truncate text-xs text-muted-foreground">{lead.title}</div> : null}
          </div>
        </div>
      </TableCell>
      <TableCell className={cn("whitespace-nowrap font-mono text-[13px]", !phone && "text-muted-foreground")}>{phone || "—"}</TableCell>
      <TableCell className={cn("max-w-[220px] truncate", !lead.email && "text-muted-foreground")} title={lead.email}>
        {lead.email || "—"}
      </TableCell>
      {viewCols ? (
        viewCols.map((c) => <ViewCell key={c.api_name} lead={lead} col={c} />)
      ) : (
        <>
          <TableCell>
            <Badge variant={statusVariant(lead.leadStatus)}>{lead.leadStatus || "—"}</Badge>
          </TableCell>
          <TableCell className={cn("whitespace-nowrap", !lead.city && "text-muted-foreground")}>{lead.city || "—"}</TableCell>
          <TableCell>
            <Badge variant={lead.source === "zoho" ? "soft" : "outline"}>{sourceLabel(lead.source)}</Badge>
          </TableCell>
        </>
      )}
      <TableCell className={cn("text-right tabular-nums", !lead.callCount && "text-muted-foreground")}>{lead.callCount ?? 0}</TableCell>
      <TableCell className="whitespace-nowrap">
        {lead.lastCallAt ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-[13px]">{relativeTime(lead.lastCallAt)}</span>
            {liveStatus ? <Badge variant={callStatusVariant(liveStatus)}>{liveStatus.replace("_", " ")}</Badge> : lead.lastCallOutcome ? <Badge variant={outcomeVariant(lead.lastCallOutcome)}>{outcomeLabel(lead.lastCallOutcome)}</Badge> : null}
          </span>
        ) : (
          <span className="text-muted-foreground">Never</span>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap text-[13px] text-muted-foreground">{relativeTime(lead.updatedAt)}</TableCell>
      <TableCell onClick={stop} className="pr-3">
        <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 has-[[data-state=open]]:opacity-100 focus-within:opacity-100">
          <Tip label={!phone ? "No phone number" : canCall ? "Call now" : "Call (pick an agent)"}>
            <span className="inline-flex">
              <Button variant="ghost" size="icon-sm" onClick={() => onCall(lead)} disabled={!phone} aria-label="Call now">
                <PhoneCall className="text-primary" />
              </Button>
            </span>
          </Tip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onCall(lead)} disabled={!phone}>
                <PhoneCall /> Call now
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onOpen(lead)}>
                <PanelRightOpen /> Open
              </DropdownMenuItem>
              {zohoUrl ? (
                <DropdownMenuItem asChild>
                  <a href={zohoUrl} target="_blank" rel="noreferrer">
                    <ExternalLink /> Open in Zoho
                  </a>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              {onRemoveFromList ? (
                <DropdownMenuItem onSelect={() => onRemoveFromList(lead)}>
                  <ListX /> Remove from list
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem destructive onSelect={() => onDelete(lead)}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}

function ViewCell({ lead, col }: { lead: Lead; col: ViewColumn }) {
  const value = leadFieldValue(lead, col.api_name);
  const empty = isEmptyValue(value);
  if (col.api_name === "Lead_Status") {
    const s = empty ? "" : formatFieldValue(value, col.data_type);
    return (
      <TableCell>
        <Badge variant={statusVariant(s)}>{s || "—"}</Badge>
      </TableCell>
    );
  }
  const numeric = isNumericType(col.data_type);
  const text = formatFieldValue(value, col.data_type);
  return (
    <TableCell className={cn("max-w-[240px] truncate whitespace-nowrap", numeric && "text-right tabular-nums", empty && "text-muted-foreground")} title={empty ? undefined : text}>
      {text}
    </TableCell>
  );
}
