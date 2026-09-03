"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, AudioWaveform, ListPlus, Plug, RefreshCw, Search, SearchX, Settings2, X } from "lucide-react";
import type { LeadList } from "@/lib/types";
import { useAgents, useClearLeadBinding, useDeleteLeadList, useLeadBinding, useLeadLists, usePhoneNumbers, useZohoStatus, useZohoSync } from "@/hooks/api";
import { errorMessage } from "@/lib/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { AttachAgentDialog } from "./AttachAgentDialog";
import { BindingBanner } from "./BindingBanner";
import { ConfirmDialog } from "./ConfirmDialog";
import { GenerateAgentDialog } from "./GenerateAgentDialog";
import { LeadListCard, LeadListCardSkeleton } from "./LeadListCard";
import { NewListDialog, RenameListDialog } from "./LeadListDialogs";
import { ZohoSyncAction } from "./ZohoSyncAction";
import { formatCount } from "./leadUtils";

const CATEGORY_ORDER = ["favourite", "favourites", "favorite", "favorites", "created_by_me", "public_views", "shared_with_me", "system_defined", "other_users"];
const categoryRank = (c?: string) => {
  const i = CATEGORY_ORDER.indexOf((c ?? "").toLowerCase());
  return i === -1 ? CATEGORY_ORDER.length : i;
};

/** `/leads` — every lead table (All leads, Zoho custom views, manual lists) as a card grid. */
export function LeadListsPage() {
  const lists = useLeadLists();
  const zoho = useZohoStatus();
  const sync = useZohoSync();
  const defaultBinding = useLeadBinding(null);
  const phones = usePhoneNumbers();
  const agents = useAgents();
  const clearBinding = useClearLeadBinding();
  const del = useDeleteLeadList();

  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [attach, setAttach] = useState<{ listId: string | null; name?: string } | null>(null);
  const [generate, setGenerate] = useState<{ listId: string; name?: string } | null>(null);
  const [detachOpen, setDetachOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<LeadList | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LeadList | null>(null);

  const zohoConnected = Boolean(zoho.data?.connected);
  const syncing = sync.isPending || zoho.data?.syncStatus === "running";
  const items = lists.data?.items ?? [];
  const hasOwnDefault = Boolean(defaultBinding.data);
  const boundPhone = useMemo(() => phones.data?.find((p) => p.phone_number_id === defaultBinding.data?.phoneNumberId), [phones.data, defaultBinding.data?.phoneNumberId]);
  const aiGenerated = useMemo(() => Boolean(agents.data?.find((a) => a._id === defaultBinding.data?.agentId)?.description?.startsWith("Generated")), [agents.data, defaultBinding.data?.agentId]);

  const ordered = useMemo(() => {
    const zohoViews = items.filter((l) => l.source === "zoho").sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || categoryRank(a.category) - categoryRank(b.category) || a.name.localeCompare(b.name));
    const manual = items.filter((l) => l.source !== "zoho").sort((a, b) => a.name.localeCompare(b.name));
    const all = lists.data?.all ? [lists.data.all] : [];
    return [...all, ...zohoViews, ...manual];
  }, [items, lists.data?.all]);

  const q = search.trim().toLowerCase();
  const visible = q ? ordered.filter((l) => l.name.toLowerCase().includes(q)) : ordered;
  const zohoCount = items.filter((l) => l.source === "zoho").length;
  const manualCount = items.length - zohoCount;

  const openAttach = (list: LeadList) => setAttach({ listId: list.source === "all" ? null : list._id, name: list.source === "all" ? undefined : list.name });
  const openGenerate = (list: LeadList) => setGenerate({ listId: list.source === "all" ? "all" : list._id, name: list.name });

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="My Leads"
        description="Lead tables synced from Zoho CRM. Open a table to call its leads."
        actions={
          <>
            <ZohoSyncAction zoho={zoho.data} zohoLoading={zoho.isLoading} />
            <Button variant="secondary" onClick={() => setNewOpen(true)}>
              <ListPlus /> New list
            </Button>
            <Button onClick={() => setAttach({ listId: null })}>
              {hasOwnDefault ? <Settings2 /> : <AudioWaveform />}
              {hasOwnDefault ? "Configure default agent" : "Default agent"}
            </Button>
          </>
        }
      />

      <BindingBanner
        scope="default"
        binding={defaultBinding.data}
        loading={defaultBinding.isLoading}
        phone={boundPhone}
        phonesLoading={phones.isLoading}
        onConfigure={() => setAttach({ listId: null })}
        onDetach={() => setDetachOpen(true)}
        onGenerate={() => setGenerate({ listId: "all", name: "All leads" })}
        aiGenerated={aiGenerated}
      />

      <div className="flex flex-wrap items-center gap-2 px-7 pb-4">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tables…" className="pl-8 pr-8" />
          {search ? (
            <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Clear search">
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
        {lists.data ? (
          <span className="ml-auto text-xs text-muted-foreground">
            {formatCount(ordered.length)} table{ordered.length === 1 ? "" : "s"}
            {zohoCount ? ` · ${formatCount(zohoCount)} Zoho view${zohoCount === 1 ? "" : "s"}` : ""}
            {manualCount ? ` · ${formatCount(manualCount)} manual` : ""}
            {lists.isFetching && !lists.isLoading ? " · refreshing…" : ""}
          </span>
        ) : null}
      </div>

      <div className="px-7 pb-10">
        {lists.error ? (
          <div className="rounded-xl border border-border bg-card">
            <EmptyState icon={AlertTriangle} title="Could not load lead tables" description={errorMessage(lists.error)} action={<Button variant="outline" onClick={() => lists.refetch()}>Retry</Button>} />
          </div>
        ) : lists.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <LeadListCardSkeleton key={i} />
            ))}
          </div>
        ) : q && !visible.length ? (
          <div className="rounded-xl border border-border bg-card">
            <EmptyState icon={SearchX} title="No tables match" description={`Nothing named “${search.trim()}”.`} action={<Button variant="outline" onClick={() => setSearch("")}>Clear search</Button>} />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 animate-fade-in">
              {visible.map((l) => (
                <LeadListCard key={l._id} list={l} defaultBinding={lists.data?.defaultBinding} onAttach={openAttach} onGenerate={openGenerate} onRename={(t) => setRenameTarget(t)} onDelete={(t) => setDeleteTarget(t)} />
              ))}
            </div>
            {!items.length && !q ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/20">
                {zohoConnected ? (
                  <EmptyState
                    icon={RefreshCw}
                    title="Sync from Zoho to pull your Zoho views"
                    description="Every custom view of your Zoho Leads module becomes a table here, with its own columns and agent."
                    action={
                      <div className="flex items-center gap-2">
                        <Button onClick={() => sync.mutate({ full: true })} loading={syncing}>
                          <RefreshCw /> Sync from Zoho
                        </Button>
                        <Button variant="outline" onClick={() => setNewOpen(true)}>
                          <ListPlus /> New list
                        </Button>
                      </div>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={Plug}
                    title="Connect Zoho CRM to import your lead tables"
                    description="Each Zoho custom view of your Leads module shows up here as a table you can call. Or start with a manual list."
                    action={
                      <div className="flex items-center gap-2">
                        <Link href="/integrations" className={buttonVariants()}>
                          <Plug /> Connect Zoho CRM
                        </Link>
                        <Button variant="outline" onClick={() => setNewOpen(true)}>
                          <ListPlus /> New list
                        </Button>
                      </div>
                    }
                  />
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <NewListDialog open={newOpen} onOpenChange={setNewOpen} />
      <RenameListDialog list={renameTarget} open={Boolean(renameTarget)} onOpenChange={(o) => !o && setRenameTarget(null)} />
      <AttachAgentDialog open={Boolean(attach)} onOpenChange={(o) => !o && setAttach(null)} listId={attach?.listId ?? null} listName={attach?.name} zohoConnected={zohoConnected} />
      <GenerateAgentDialog open={Boolean(generate)} onOpenChange={(o) => !o && setGenerate(null)} listId={generate?.listId ?? "all"} listName={generate?.name} zohoConnected={zohoConnected} />
      <ConfirmDialog
        open={detachOpen}
        onOpenChange={setDetachOpen}
        title="Detach default voice agent?"
        description="Tables without their own agent will no longer be callable until you attach a default again. List-specific agents and the agent itself are kept."
        confirmLabel="Detach"
        destructive
        loading={clearBinding.isPending}
        onConfirm={() => clearBinding.mutate(null, { onSuccess: () => setDetachOpen(false) })}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Delete “${deleteTarget?.name ?? "list"}”?`}
        description={`Removes the list and its agent binding. The ${formatCount(deleteTarget?.recordCount ?? 0)} lead${deleteTarget?.recordCount === 1 ? "" : "s"} in it stay in All leads.`}
        confirmLabel="Delete list"
        destructive
        loading={del.isPending}
        onConfirm={() => deleteTarget && del.mutate(deleteTarget._id, { onSuccess: () => setDeleteTarget(null) })}
      />
    </div>
  );
}
