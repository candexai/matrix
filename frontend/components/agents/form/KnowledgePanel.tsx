"use client";
import { useMemo, useState } from "react";
import { BookOpen, ExternalLink, File, FileText, Globe, Trash2 } from "lucide-react";
import { useDeleteKnowledgeDoc, useKnowledgeDocs } from "@/hooks/api";
import type { KnowledgeDoc } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/ui/tooltip";
import { uniq } from "../agent-utils";
import { ConfirmDialog } from "../ConfirmDialog";
import { KnowledgeDocDialog } from "./KnowledgeDocDialog";
import { AddButton, SubHeading } from "./primitives";
import { AdvancedIds, formatBytes, formatDate, PanelEmpty, PanelError, PanelList, PanelRow, PanelSkeleton } from "./resource-panel";

const TYPE_META: Record<string, { icon: typeof Globe; label: string }> = {
  url: { icon: Globe, label: "Web page" },
  text: { icon: FileText, label: "Text" },
  file: { icon: File, label: "File" },
};

export function KnowledgePanel({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const docs = useKnowledgeDocs();
  const del = useDeleteKnowledgeDoc();
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<KnowledgeDoc | null>(null);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const known = useMemo(() => new Set((docs.data ?? []).map((d) => d.id)), [docs.data]);
  const unknown = selected.filter((id) => !known.has(id));
  const toggle = (id: string, on: boolean) => onChange(on ? uniq([...selected, id]) : selected.filter((x) => x !== id));

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
      <SubHeading
        title={`Knowledge base · ${selected.length} selected`}
        description="Documents are stored in your ElevenLabs workspace and can be reused by every agent. The agent answers from them using RAG."
        action={<AddButton onClick={() => setAddOpen(true)}>Add document</AddButton>}
      />

      {docs.isPending ? (
        <PanelSkeleton />
      ) : docs.isError ? (
        <PanelError error={docs.error} onRetry={() => docs.refetch()} retrying={docs.isFetching} />
      ) : docs.data.length === 0 ? (
        <PanelEmpty icon={BookOpen} title="No documents yet" description="Add a web page, paste text (FAQs, pricing, policies) or upload a file so the agent can answer from it." action={<AddButton onClick={() => setAddOpen(true)}>Add document</AddButton>} />
      ) : (
        <PanelList>
          {docs.data.map((d) => {
            const meta = TYPE_META[d.type] ?? { icon: File, label: d.type };
            const Icon = meta.icon;
            const size = formatBytes(d.sizeBytes);
            const created = formatDate(d.createdAt);
            return (
              <PanelRow
                key={d.id}
                id={`kb-${d.id}`}
                checked={selectedSet.has(d.id)}
                onCheckedChange={(v) => toggle(d.id, v)}
                leading={
                  <Tip label={meta.label}>
                    <span className="flex size-7 items-center justify-center rounded-md bg-muted">
                      <Icon className="size-3.5" strokeWidth={1.8} />
                    </span>
                  </Tip>
                }
                title={<span className="min-w-0 max-w-full truncate">{d.name || d.id}</span>}
                description={d.type === "url" && d.url ? <span className="font-mono text-[11.5px]">{d.url}</span> : undefined}
                meta={
                  <>
                    <span>{meta.label}</span>
                    {size ? <span className="tabular-nums">{size}</span> : null}
                    {created ? <span>Added {created}</span> : null}
                    {d.dependentAgents ? (
                      <span>
                        Used by {d.dependentAgents} agent{d.dependentAgents === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </>
                }
                actions={
                  <>
                    {d.type === "url" && d.url ? (
                      <Tip label="Open page">
                        <a href={d.url} target="_blank" rel="noreferrer" className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Open page">
                          <ExternalLink className="size-4" />
                        </a>
                      </Tip>
                    ) : null}
                    <Tip label="Delete document">
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => setPendingDelete(d)} aria-label={`Delete ${d.name}`} className="text-muted-foreground hover:text-destructive">
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

      <AdvancedIds label="document IDs" value={selected} onChange={onChange} placeholder="doc_01j…" unknownCount={docs.data ? unknown.length : 0} help="For documents uploaded elsewhere in ElevenLabs. Attached with usage mode “auto”. Press Enter after each." />

      <KnowledgeDocDialog open={addOpen} onOpenChange={setAddOpen} onAdded={(doc) => onChange(uniq([...selected, doc.id]))} />
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(o) => (!o ? setPendingDelete(null) : undefined)}
        title={`Delete "${pendingDelete?.name ?? "document"}"?`}
        description={
          pendingDelete?.dependentAgents
            ? `Removes it from your ElevenLabs workspace. It is used by ${pendingDelete.dependentAgents} agent${pendingDelete.dependentAgents === 1 ? "" : "s"} — ElevenLabs may refuse until they are detached.`
            : "Removes it from your ElevenLabs workspace for every agent. This cannot be undone."
        }
        confirmLabel="Delete document"
        destructive
        loading={del.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
