"use client";
import { useMemo, useState } from "react";
import { ListPlus, Search, SearchX, X } from "lucide-react";
import type { Lead } from "@/lib/types";
import { useAddLeadsToList, useLeads } from "@/hooks/api";
import { cn, initials } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ALL_LIST_ID, formatCount, sourceLabel, statusVariant, useDebounced } from "./leadUtils";

/** Searchable checklist of every lead in the workspace → add the picked ones to a manual list. */
export function AddExistingLeadsDialog({ listId, listName, open, onOpenChange }: { listId: string; listName: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="h-[640px]">
        {/* Radix unmounts the content when closed, so the query below only runs while the dialog is open. */}
        <Body listId={listId} listName={listName} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function Body({ listId, listName, onClose }: { listId: string; listName: string; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search.trim(), 250);
  const leads = useLeads({ listId: ALL_LIST_ID, search: debounced || undefined, limit: 50, page: 1 });
  const add = useAddLeadsToList();
  const [picked, setPicked] = useState<Map<string, Lead>>(() => new Map());

  const items = leads.data?.items ?? [];
  const total = leads.data?.total ?? 0;
  const candidates = useMemo(() => items.filter((l) => !l.listIds?.includes(listId)), [items, listId]);
  const alreadyIn = items.length - candidates.length;

  const toggle = (lead: Lead) =>
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(lead._id)) next.delete(lead._id);
      else next.set(lead._id, lead);
      return next;
    });
  const pageAllPicked = candidates.length > 0 && candidates.every((l) => picked.has(l._id));
  const togglePage = (checked: boolean) =>
    setPicked((prev) => {
      const next = new Map(prev);
      for (const l of candidates) {
        if (checked) next.set(l._id, l);
        else next.delete(l._id);
      }
      return next;
    });

  const submit = () => {
    if (!picked.size) return;
    add.mutate({ id: listId, leadIds: Array.from(picked.keys()) }, { onSuccess: onClose });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add existing leads to {listName}</DialogTitle>
        <DialogDescription>Pick leads from anywhere in your workspace. Leads already in this list are hidden.</DialogDescription>
      </DialogHeader>
      <DialogBody className="flex min-h-0 flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone, email, company…" className="pl-8 pr-8" autoFocus />
            {search ? (
              <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Clear search">
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
            <Checkbox checked={pageAllPicked} onCheckedChange={(c) => togglePage(c === true)} disabled={!candidates.length} />
            Select shown
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border">
          {leads.isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !candidates.length ? (
            <EmptyState icon={SearchX} title={debounced ? "No leads match" : alreadyIn ? "Everything is already in this list" : "No leads yet"} description={debounced ? "Try a different search." : "Sync from Zoho or add leads manually first."} className="py-12" />
          ) : (
            <ul className={cn("divide-y divide-border", leads.isFetching && "opacity-70 transition-opacity")}>
              {candidates.map((lead) => {
                const checked = picked.has(lead._id);
                const phone = lead.phone || lead.mobile;
                return (
                  <li key={lead._id} className={cn(checked && "bg-accent-tint/30")}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2">
                      <Checkbox checked={checked} onCheckedChange={() => toggle(lead)} />
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-tint text-[11px] font-medium text-primary-hover">{initials(lead.fullName)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{lead.fullName || "Unnamed lead"}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[lead.company, phone, lead.email].filter(Boolean).join(" · ") || "No contact details"}
                        </span>
                      </span>
                      {lead.leadStatus ? <Badge variant={statusVariant(lead.leadStatus)}>{lead.leadStatus}</Badge> : null}
                      <Badge variant={lead.source === "zoho" ? "soft" : "outline"}>{sourceLabel(lead.source)}</Badge>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {leads.data ? `Showing ${formatCount(candidates.length)} of ${formatCount(total)} lead${total === 1 ? "" : "s"}${total > items.length ? " — refine the search to find more" : ""}${alreadyIn ? ` · ${alreadyIn} already in this list` : ""}` : " "}
        </p>
      </DialogBody>
      <DialogFooter className="justify-between">
        <span className="text-xs text-muted-foreground tabular-nums">
          {picked.size} selected
          {picked.size ? (
            <button type="button" onClick={() => setPicked(new Map())} className="ml-2 text-primary hover:underline">
              clear
            </button>
          ) : null}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={add.isPending} disabled={!picked.size}>
            <ListPlus /> Add {picked.size || ""} to list
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}
