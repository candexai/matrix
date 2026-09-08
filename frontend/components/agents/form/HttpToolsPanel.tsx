"use client";
import { useMemo, useState } from "react";
import { Pencil, Trash2, Webhook } from "lucide-react";
import { useDeleteHttpTool, useHttpTools } from "@/hooks/api";
import type { HttpTool } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/ui/tooltip";
import { uniq } from "../agent-utils";
import { ConfirmDialog } from "../ConfirmDialog";
import { HttpToolDialog, METHOD_BADGE } from "./HttpToolDialog";
import { AddButton, SubHeading } from "./primitives";
import { AdvancedIds, PanelEmpty, PanelError, PanelList, PanelRow, PanelSkeleton } from "./resource-panel";

/** "Used by N agents" / "N calls" from ElevenLabs' loosely-typed usage_stats, when it carries something sensible. */
function usageMeta(t: HttpTool): string | null {
  const u = t.usage_stats;
  if (!u || typeof u !== "object") return null;
  const r = u as Record<string, unknown>;
  const agents = Array.isArray(r.dependent_agents) ? r.dependent_agents.length : typeof r.dependent_agents === "number" ? r.dependent_agents : typeof r.agent_count === "number" ? r.agent_count : null;
  if (typeof agents === "number" && agents > 0) return `Used by ${agents} agent${agents === 1 ? "" : "s"}`;
  const calls = typeof r.total_calls === "number" ? r.total_calls : null;
  if (calls && calls > 0) return `${calls.toLocaleString()} call${calls === 1 ? "" : "s"}`;
  return null;
}

export function HttpToolsPanel({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const tools = useHttpTools();
  const del = useDeleteHttpTool();
  const [dialog, setDialog] = useState<{ open: boolean; tool?: HttpTool }>({ open: false });
  const [pendingDelete, setPendingDelete] = useState<HttpTool | null>(null);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const known = useMemo(() => new Set((tools.data ?? []).map((t) => t.id)), [tools.data]);
  const unknown = selected.filter((id) => !known.has(id));
  const toggle = (id: string, on: boolean) => onChange(on ? uniq([...selected, id]) : selected.filter((x) => x !== id));

  const openNew = () => setDialog({ open: true });
  const confirmDelete = () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    del.mutate(id, {
      onSuccess: () => {
        onChange(selected.filter((x) => x !== id));
        setPendingDelete(null);
      },
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <SubHeading title={`HTTP tools · ${selected.length} selected`} description="Let the agent call your API mid-call — check availability, look up an order, update a record." action={<AddButton onClick={openNew}>New HTTP tool</AddButton>} />

      {tools.isPending ? (
        <PanelSkeleton />
      ) : tools.isError ? (
        <PanelError error={tools.error} onRetry={() => tools.refetch()} retrying={tools.isFetching} />
      ) : tools.data.length === 0 ? (
        <PanelEmpty icon={Webhook} title="No HTTP tools yet" description="Create one to let the agent call your API during the call." action={<AddButton onClick={openNew}>New HTTP tool</AddButton>} />
      ) : (
        <PanelList>
          {tools.data.map((t) => {
            const usage = usageMeta(t);
            const params = t.params?.length ?? 0;
            return (
              <PanelRow
                key={t.id}
                id={`tool-${t.id}`}
                checked={selectedSet.has(t.id)}
                onCheckedChange={(v) => toggle(t.id, v)}
                title={
                  <>
                    <span className="font-mono text-[13px]">{t.name || t.id}</span>
                    <Badge variant={METHOD_BADGE[t.method] ?? "secondary"} className="font-mono">
                      {t.method}
                    </Badge>
                    <span className="min-w-0 max-w-[26rem] truncate font-mono text-[11.5px] font-normal text-muted-foreground" title={t.url}>
                      {t.url}
                    </span>
                  </>
                }
                description={t.description}
                meta={
                  <>
                    <span>
                      {params} param{params === 1 ? "" : "s"}
                    </span>
                    {usage ? <span>{usage}</span> : null}
                    <span className="tabular-nums">{t.response_timeout_secs}s timeout</span>
                  </>
                }
                actions={
                  <>
                    <Tip label="Edit tool">
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => setDialog({ open: true, tool: t })} aria-label={`Edit ${t.name}`}>
                        <Pencil />
                      </Button>
                    </Tip>
                    <Tip label="Delete tool">
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => setPendingDelete(t)} aria-label={`Delete ${t.name}`} className="text-muted-foreground hover:text-destructive">
                        <Trash2 />
                      </Button>
                    </Tip>
                  </>
                }
              />
            );
          })}
        </PanelList>
      )}

      <AdvancedIds
        label="tool IDs"
        value={selected}
        onChange={onChange}
        placeholder="tool_01j…"
        unknownCount={tools.data ? unknown.length : 0}
        help="For tools created elsewhere (ElevenLabs dashboard → Tools → copy ID). Tools ticked above appear here too. Press Enter after each."
      />

      <HttpToolDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((s) => ({ ...s, open }))}
        tool={dialog.tool}
        onSaved={(t) => onChange(uniq([...selected, t.id]))}
      />
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(o) => (!o ? setPendingDelete(null) : undefined)}
        title={`Delete "${pendingDelete?.name ?? "tool"}"?`}
        description="Removes the tool from your ElevenLabs workspace for every agent that uses it. This cannot be undone."
        confirmLabel="Delete tool"
        destructive
        loading={del.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
