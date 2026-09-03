"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AudioWaveform, ChevronLeft, ChevronRight, Plug, RefreshCw, Search, Table2, UserPlus, X, PhoneOutgoing, AlertTriangle, SearchX, Settings2, ListPlus, ListX, ArrowLeft, Sparkles } from "lucide-react";
import type { Lead } from "@/lib/types";
import { useAgents, useClearLeadBinding, useDeleteLead, useLeadBinding, useLeadList, useLeads, usePhoneNumbers, useRemoveLeadsFromList, useZohoStatus, useZohoSync } from "@/hooks/api";
import { errorMessage } from "@/lib/api";
import { cn, relativeTime } from "@/lib/utils";
import { useSidebar } from "@/components/layout/SidebarContext";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AddExistingLeadsDialog } from "./AddExistingLeadsDialog";
import { AddLeadDialog } from "./AddLeadDialog";
import { AttachAgentDialog } from "./AttachAgentDialog";
import { BatchCallDialog } from "./BatchCallDialog";
import { BindingBanner } from "./BindingBanner";
import { CallLeadDialog } from "./CallLeadDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { GenerateAgentDialog } from "./GenerateAgentDialog";
import { LeadDrawer } from "./LeadDrawer";
import { LeadsTable } from "./LeadsTable";
import { ZohoSyncAction } from "./ZohoSyncAction";
import { categoryLabel, formatCount, isRealListId, listSourceLabel, useDebounced } from "./leadUtils";

const ALL = "__all__";
const PAGE_SIZES = [25, 50, 100] as const;

/** `/leads/[listId]` — the rows of one lead table (All leads, a Zoho custom view, or a manual list). */
export function LeadsTableView({ listId }: { listId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openParam = searchParams.get("open");
  const { width: sidebarWidth } = useSidebar();
  const isAll = !isRealListId(listId);
  const basePath = `/leads/${encodeURIComponent(listId)}`;

  // ---- filters ----
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search.trim(), 300);
  const [status, setStatus] = useState(ALL);
  const [source, setSource] = useState(ALL);
  const [called, setCalled] = useState(ALL);
  const [limit, setLimit] = useState<number>(50);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [debouncedSearch, status, source, called, limit, listId]);

  const filters = useMemo(
    () => ({
      listId,
      search: debouncedSearch || undefined,
      status: status === ALL ? undefined : status,
      source: source === ALL ? undefined : source,
      called: called === ALL ? undefined : (called as "yes" | "no"),
      page,
      limit,
    }),
    [listId, debouncedSearch, status, source, called, page, limit]
  );
  const hasFilters = Boolean(debouncedSearch) || status !== ALL || source !== ALL || called !== ALL;
  const clearFilters = () => {
    setSearch("");
    setStatus(ALL);
    setSource(ALL);
    setCalled(ALL);
  };

  // ---- data ----
  const list = useLeadList(listId);
  const leads = useLeads(filters);
  const binding = useLeadBinding(listId);
  const zoho = useZohoStatus();
  const phones = usePhoneNumbers();
  const agents = useAgents();
  const sync = useZohoSync();
  const clearBinding = useClearLeadBinding();
  const del = useDeleteLead();
  const removeFromList = useRemoveLeadsFromList();

  const listData = list.data;
  const listName = listData?.name ?? (isAll ? "All leads" : "");
  const isZohoView = listData?.source === "zoho";
  const isManual = listData?.source === "manual";
  // Table columns mirror the Zoho view definition exactly (order included). Every other field is
  // still visible in the lead drawer.
  const viewColumns = listData?.resolvedColumns?.length ? listData.resolvedColumns : undefined;
  const inherited = Boolean(binding.data?.inherited);
  const hasOwnBinding = Boolean(binding.data) && !inherited;

  const zohoConnected = Boolean(zoho.data?.connected);
  const items = leads.data?.items ?? [];
  const total = leads.data?.total ?? 0;
  const pages = leads.data?.pages ?? 0;
  const statuses = leads.data?.statuses ?? [];
  const boundPhone = useMemo(() => phones.data?.find((p) => p.phone_number_id === binding.data?.phoneNumberId), [phones.data, binding.data?.phoneNumberId]);
  const aiGenerated = useMemo(() => Boolean(agents.data?.find((a) => a._id === binding.data?.agentId)?.description?.startsWith("Generated")), [agents.data, binding.data?.agentId]);

  // ---- selection ----
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  useEffect(() => setSelected(new Set()), [listId]);
  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const toggleAll = useCallback(
    (checked: boolean) => {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const l of items) {
          if (checked) next.add(l._id);
          else next.delete(l._id);
        }
        return next;
      });
    },
    [items]
  );
  const clearSelection = () => setSelected(new Set());
  const dropFromSelection = (ids: string[]) =>
    setSelected((prev) => {
      if (!ids.some((id) => prev.has(id))) return prev;
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });

  // ---- drawer (synced with ?open=) ----
  const [openId, setOpenId] = useState<string | null>(openParam);
  useEffect(() => setOpenId(openParam), [openParam]);
  const openLead = (lead: Lead) => {
    setOpenId(lead._id);
    router.replace(`${basePath}?open=${lead._id}`, { scroll: false });
  };
  const closeLead = () => {
    setOpenId(null);
    if (searchParams.get("open")) router.replace(basePath, { scroll: false });
  };

  // ---- dialogs ----
  const [attachTarget, setAttachTarget] = useState<"list" | "default" | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addExistingOpen, setAddExistingOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [detachOpen, setDetachOpen] = useState(false);
  const [removeSelectedOpen, setRemoveSelectedOpen] = useState(false);
  const [callLead, setCallLead] = useState<Lead | null>(null);
  const [deleteLead, setDeleteLead] = useState<Lead | null>(null);

  const openAttach = () => setAttachTarget(isAll ? "default" : "list");

  const confirmDelete = () => {
    if (!deleteLead) return;
    const id = deleteLead._id;
    del.mutate(id, {
      onSuccess: () => {
        setDeleteLead(null);
        dropFromSelection([id]);
        if (openId === id) closeLead();
      },
    });
  };
  const removeLeads = (ids: string[], after?: () => void) => {
    if (!isRealListId(listId) || !ids.length) return;
    removeFromList.mutate(
      { id: listId, leadIds: ids },
      {
        onSuccess: () => {
          dropFromSelection(ids);
          if (openId && ids.includes(openId)) closeLead();
          after?.();
        },
      }
    );
  };

  // ---- derived UI state ----
  const syncing = sync.isPending || zoho.data?.syncStatus === "running";
  const start = total ? (page - 1) * limit + 1 : 0;
  const end = Math.min(page * limit, total);
  const showEmpty = !leads.isLoading && !leads.error && items.length === 0;
  const columnCount = isAll ? null : listData?.columns?.length ?? 0;
  const subtitle = listData
    ? [`${formatCount(listData.recordCount ?? 0)} lead${listData.recordCount === 1 ? "" : "s"}`, listSourceLabel(listData.source), columnCount === null ? "default columns" : `${columnCount} column${columnCount === 1 ? "" : "s"}`].join(" · ")
    : "";

  if (list.error) {
    const status404 = (list.error as { status?: number } | null)?.status === 404;
    return (
      <div className="flex flex-1 flex-col">
        <EmptyState
          icon={Table2}
          title={status404 ? "Lead table not found" : "Couldn't load this lead table"}
          description={status404 ? "It may have been deleted, or the Zoho view no longer exists." : errorMessage(list.error)}
          action={
            <div className="flex gap-2">
              <Link href="/leads" className={buttonVariants({ variant: "outline" })}>
                <ArrowLeft /> All tables
              </Link>
              {!status404 ? <Button onClick={() => list.refetch()}>Retry</Button> : null}
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 px-7 pt-6 text-[13px] text-muted-foreground">
        <Link href="/leads" className="inline-flex items-center gap-1 hover:text-foreground">
          <Table2 className="size-3.5" /> My Leads
        </Link>
        <ChevronRight className="size-3.5 text-border" />
        {listData ? <span className="truncate text-foreground">{listData.name}</span> : <Skeleton className="h-3.5 w-28" />}
      </nav>

      {listData ? (
        <PageHeader
          className="pt-2"
          title={listData.name}
          description={subtitle}
          actions={
            <>
              <ZohoSyncAction zoho={zoho.data} zohoLoading={zoho.isLoading} />
              {!isZohoView ? (
                <Button variant="secondary" onClick={() => setAddOpen(true)}>
                  <UserPlus /> Add lead
                </Button>
              ) : null}
              {isManual ? (
                <Button variant="secondary" onClick={() => setAddExistingOpen(true)}>
                  <ListPlus /> Add existing leads
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => setGenerateOpen(true)}>
                <Sparkles /> Generate agent with AI
              </Button>
              <Button onClick={openAttach}>
                {hasOwnBinding ? <Settings2 /> : <AudioWaveform />}
                {hasOwnBinding ? (isAll ? "Configure default agent" : "Configure agent") : isAll ? "Attach default agent" : "Attach voice agent"}
              </Button>
            </>
          }
        >
          {isZohoView || (isManual && listData.updatedAt) ? (
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
              {isZohoView ? (
                <>
                  <Badge variant="soft">
                    <RefreshCw /> Synced from Zoho custom view
                  </Badge>
                  {listData.category ? <Badge variant="outline">{categoryLabel(listData.category)}</Badge> : null}
                  {listData.isDefault ? <Badge variant="secondary">Default view</Badge> : null}
                  {listData.systemName ? <span className="font-mono text-xs">{listData.systemName}</span> : null}
                  <span>{listData.lastSyncAt ? `Rows synced ${relativeTime(listData.lastSyncAt)}` : "Not synced yet"}</span>
                </>
              ) : (
                <span>Manual list · updated {relativeTime(listData.updatedAt)}</span>
              )}
            </div>
          ) : null}
        </PageHeader>
      ) : (
        <div className="px-7 pb-4 pt-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-2 h-4 w-80" />
        </div>
      )}

      <BindingBanner
        scope={isAll ? "default" : "list"}
        listName={listName}
        binding={binding.data}
        loading={binding.isLoading || (!listData && list.isLoading)}
        phone={boundPhone}
        phonesLoading={phones.isLoading}
        onConfigure={openAttach}
        onDetach={() => setDetachOpen(true)}
        onManageDefault={() => setAttachTarget("default")}
        onGenerate={() => setGenerateOpen(true)}
        aiGenerated={aiGenerated}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 px-7 pb-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone, email, company…" className="pl-8 pr-8" />
          {search ? (
            <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Clear search">
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!isZohoView ? (
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All sources</SelectItem>
              <SelectItem value="zoho">Zoho</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="csv">CSV</SelectItem>
            </SelectContent>
          </Select>
        ) : null}
        <Select value={called} onValueChange={setCalled}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Called or not" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Called or not</SelectItem>
            <SelectItem value="yes">Called</SelectItem>
            <SelectItem value="no">Never called</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
            <X /> Clear
          </Button>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {leads.data ? (
            <span className="text-xs text-muted-foreground">
              {formatCount(total)} lead{total === 1 ? "" : "s"}
              {leads.isFetching && !leads.isLoading ? " · refreshing…" : ""}
            </span>
          ) : null}
          <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
            <SelectTrigger className="w-[112px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="px-7 pb-24">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          {leads.error ? (
            <EmptyState icon={AlertTriangle} title="Could not load leads" description={errorMessage(leads.error)} action={<Button variant="outline" onClick={() => leads.refetch()}>Retry</Button>} />
          ) : showEmpty ? (
            hasFilters ? (
              <EmptyState icon={SearchX} title="No leads match" description="Try a different search or clear the filters." action={<Button variant="outline" onClick={clearFilters}>Clear filters</Button>} />
            ) : isZohoView ? (
              <EmptyState
                icon={Table2}
                title="No leads in this list yet"
                description={zohoConnected ? "Rows appear after Sync from Zoho. The view may also be empty in Zoho CRM." : "Rows appear after Sync from Zoho — reconnect Zoho in Integrations first."}
                action={
                  zohoConnected ? (
                    <Button onClick={() => sync.mutate({ full: false })} loading={syncing}>
                      <RefreshCw /> Sync from Zoho
                    </Button>
                  ) : (
                    <Link href="/integrations" className={buttonVariants()}>
                      <Plug /> Connect Zoho CRM
                    </Link>
                  )
                }
              />
            ) : isManual ? (
              <EmptyState
                icon={Table2}
                title="No leads in this list yet"
                description="Create a new lead here, or pick existing leads from anywhere in your workspace."
                action={
                  <div className="flex items-center gap-2">
                    <Button onClick={() => setAddExistingOpen(true)}>
                      <ListPlus /> Add existing leads
                    </Button>
                    <Button variant="outline" onClick={() => setAddOpen(true)}>
                      <UserPlus /> Add lead
                    </Button>
                  </div>
                }
              />
            ) : zohoConnected ? (
              <EmptyState
                icon={Table2}
                title="No leads yet"
                description="Zoho is connected. Pull your Leads module into Matrix to start calling."
                action={
                  <div className="flex items-center gap-2">
                    <Button onClick={() => sync.mutate({ full: true })} loading={syncing}>
                      <RefreshCw /> Sync from Zoho
                    </Button>
                    <Button variant="outline" onClick={() => setAddOpen(true)}>
                      <UserPlus /> Add lead
                    </Button>
                  </div>
                }
              />
            ) : (
              <EmptyState
                icon={Plug}
                title="Connect Zoho CRM"
                description="Sync your Zoho Leads into Matrix, then attach a voice agent to call them and fill in missing details automatically."
                action={
                  <div className="flex items-center gap-2">
                    <Link href="/integrations" className={buttonVariants()}>
                      <Plug /> Connect Zoho CRM
                    </Link>
                    <Button variant="outline" onClick={() => setAddOpen(true)}>
                      <UserPlus /> Add lead manually
                    </Button>
                  </div>
                }
              />
            )
          ) : (
            <>
              <div className={cn("max-h-[calc(100svh-300px)] min-h-[240px] overflow-auto", leads.isFetching && !leads.isLoading && "opacity-70 transition-opacity")}>
                <LeadsTable
                  leads={items}
                  loading={leads.isLoading || list.isLoading}
                  skeletonRows={Math.min(limit, 12)}
                  selected={selected}
                  onToggle={toggle}
                  onToggleAll={toggleAll}
                  onOpen={openLead}
                  onCall={setCallLead}
                  onDelete={setDeleteLead}
                  onRemoveFromList={isManual ? (l) => removeLeads([l._id]) : undefined}
                  accountsUrl={zoho.data?.accountsUrl}
                  canCall={Boolean(binding.data)}
                  columns={viewColumns}
                />
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-4 py-2 text-[13px] text-muted-foreground">
                <span>{leads.isLoading ? "Loading…" : total ? `Showing ${formatCount(start)}–${formatCount(end)} of ${formatCount(total)}` : "No leads"}</span>
                <div className="flex items-center gap-1">
                  <span className="mr-2 tabular-nums">
                    Page {page} of {Math.max(1, pages)}
                  </span>
                  <Button variant="outline" size="icon-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || leads.isLoading} aria-label="Previous page">
                    <ChevronLeft />
                  </Button>
                  <Button variant="outline" size="icon-sm" onClick={() => setPage((p) => Math.min(Math.max(1, pages), p + 1))} disabled={page >= pages || leads.isLoading} aria-label="Next page">
                    <ChevronRight />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Selection bar */}
      {selected.size > 0 ? (
        <div className="fixed bottom-6 z-40 -translate-x-1/2 animate-fade-up" style={{ left: `calc(50% + ${sidebarWidth / 2}px)` }}>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-2xl">
            <span className="px-1 text-sm font-medium tabular-nums">{selected.size} selected</span>
            <div className="h-5 w-px bg-border" />
            <Button size="sm" onClick={() => setBatchOpen(true)}>
              <PhoneOutgoing /> Call selected with agent
            </Button>
            {isManual ? (
              <Button size="sm" variant="outline" onClick={() => setRemoveSelectedOpen(true)}>
                <ListX /> Remove from list
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={clearSelection}>
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      {/* Overlays */}
      <LeadDrawer leadId={openId} onClose={closeLead} statuses={statuses} zohoConnected={zohoConnected} accountsUrl={zoho.data?.accountsUrl} onCall={setCallLead} onDelete={setDeleteLead} />
      <AttachAgentDialog open={attachTarget !== null} onOpenChange={(o) => !o && setAttachTarget(null)} listId={attachTarget === "list" ? listId : null} listName={attachTarget === "list" ? listName : undefined} zohoConnected={zohoConnected} />
      <GenerateAgentDialog open={generateOpen} onOpenChange={setGenerateOpen} listId={listId} listName={listName} zohoConnected={zohoConnected} />
      <AddLeadDialog open={addOpen} onOpenChange={setAddOpen} statuses={statuses} zohoConnected={zohoConnected} listId={isManual ? listId : undefined} listName={isManual ? listName : undefined} />
      {isManual && isRealListId(listId) ? <AddExistingLeadsDialog listId={listId} listName={listName} open={addExistingOpen} onOpenChange={setAddExistingOpen} /> : null}
      <CallLeadDialog lead={callLead} open={Boolean(callLead)} onOpenChange={(o) => !o && setCallLead(null)} binding={binding.data} listId={listId} listName={listName} />
      <BatchCallDialog leadIds={Array.from(selected)} open={batchOpen} onOpenChange={setBatchOpen} binding={binding.data} onSubmitted={clearSelection} listId={listId} listName={listName} />
      <ConfirmDialog
        open={detachOpen}
        onOpenChange={setDetachOpen}
        title={isAll ? "Detach default voice agent?" : `Detach agent from ${listName}?`}
        description={isAll ? "Tables without their own agent will no longer be callable until you attach a default again. The agent itself is not deleted." : "This table goes back to the default voice agent (if one is set). The agent itself is not deleted."}
        confirmLabel="Detach"
        destructive
        loading={clearBinding.isPending}
        onConfirm={() => clearBinding.mutate(isAll ? null : listId, { onSuccess: () => setDetachOpen(false) })}
      />
      <ConfirmDialog
        open={removeSelectedOpen}
        onOpenChange={setRemoveSelectedOpen}
        title={`Remove ${selected.size} lead${selected.size === 1 ? "" : "s"} from ${listName}?`}
        description="They stay in All leads and in any other list — only this list's membership changes."
        confirmLabel="Remove"
        loading={removeFromList.isPending}
        onConfirm={() => removeLeads(Array.from(selected), () => setRemoveSelectedOpen(false))}
      />
      <ConfirmDialog
        open={Boolean(deleteLead)}
        onOpenChange={(o) => !o && setDeleteLead(null)}
        title={`Delete ${deleteLead?.fullName ?? "lead"}?`}
        description={deleteLead?.zohoId ? "Removes the lead from Matrix only — the Zoho CRM record is kept and will come back on the next sync." : "This removes the lead from Matrix permanently."}
        confirmLabel="Delete"
        destructive
        loading={del.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
