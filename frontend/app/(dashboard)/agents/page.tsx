"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { AudioWaveform, Download, Plus, Search, TriangleAlert } from "lucide-react";
import { useAgents, useCatalog, useDeleteAgent, useSyncAgent, useVoices } from "@/hooks/api";
import { errorMessage } from "@/lib/api";
import type { Agent } from "@/lib/types";
import { AgentCard } from "@/components/agents/AgentCard";
import { ConfirmDialog } from "@/components/agents/ConfirmDialog";
import { ImportAgentsDialog } from "@/components/agents/ImportAgentsDialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <Skeleton className="size-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
      <div className="mt-4 flex gap-1.5">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-14 w-full" />
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-8 flex-1" />
        <Skeleton className="h-8 flex-1" />
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const agents = useAgents();
  const catalog = useCatalog();
  const voices = useVoices();
  const del = useDeleteAgent();
  const sync = useSyncAgent();
  const [importOpen, setImportOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Agent | null>(null);
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const all = agents.data ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((a) => [a.name, a.description, a.elevenAgentId, a.config?.llm, a.config?.language].filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [agents.data, q]);

  const total = agents.data?.length ?? 0;

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Voice Agents"
        description="ElevenLabs conversational agents that call and qualify your leads."
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Download /> Import from ElevenLabs
            </Button>
            <Link href="/agents/new" className={buttonVariants()}>
              <Plus /> New agent
            </Link>
          </>
        }
      >
        {total > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search agents…" className="pl-8" />
            </div>
            <span className="text-sm text-muted-foreground">
              {q ? `${list.length} of ${total}` : total} {total === 1 ? "agent" : "agents"}
            </span>
          </div>
        ) : null}
      </PageHeader>

      <div className="px-7 pb-8">
        {agents.isPending ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : agents.isError ? (
          <EmptyState
            icon={TriangleAlert}
            title="Couldn't load agents"
            description={errorMessage(agents.error)}
            action={
              <Button variant="outline" onClick={() => agents.refetch()}>
                Retry
              </Button>
            }
          />
        ) : total === 0 ? (
          <EmptyState
            icon={AudioWaveform}
            title="No voice agents yet"
            description="Create your first agent from scratch, or import one you already built in ElevenLabs."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/agents/new" className={buttonVariants()}>
                  <Plus /> New agent
                </Link>
                <Button variant="outline" onClick={() => setImportOpen(true)}>
                  <Download /> Import from ElevenLabs
                </Button>
              </div>
            }
          />
        ) : list.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No agents match"
            description={`Nothing matches “${q}”.`}
            action={
              <Button variant="outline" onClick={() => setQ("")}>
                Clear search
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.map((a) => (
              <AgentCard key={a._id} agent={a} catalog={catalog.data} voices={voices.data} onSync={(ag) => sync.mutate(ag._id)} onDelete={setToDelete} syncing={sync.isPending && sync.variables === a._id} />
            ))}
          </div>
        )}
      </div>

      <ImportAgentsDialog open={importOpen} onOpenChange={setImportOpen} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => (!o ? setToDelete(null) : undefined)}
        title={`Delete “${toDelete?.name ?? "agent"}”?`}
        description="This removes the agent from Matrix and from your ElevenLabs workspace. Past conversations are kept."
        confirmLabel="Delete agent"
        destructive
        loading={del.isPending}
        onConfirm={() => (toDelete ? del.mutate(toDelete._id, { onSuccess: () => setToDelete(null) }) : undefined)}
      />
    </div>
  );
}
