"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, AudioWaveform, FlaskConical, RefreshCw, Trash2, Webhook } from "lucide-react";
import { useAgent, useDeleteAgent, useSyncAgent } from "@/hooks/api";
import { errorMessage } from "@/lib/api";
import { formatNumber, relativeTime } from "@/lib/utils";
import { AgentForm } from "@/components/agents/AgentForm";
import { ConfirmDialog } from "@/components/agents/ConfirmDialog";
import { CopyButton } from "@/components/agents/CopyButton";
import { providerLabel } from "@/components/agents/agent-utils";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tip } from "@/components/ui/tooltip";

export default function EditAgentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const agent = useAgent(id);
  const sync = useSyncAgent();
  const del = useDeleteAgent();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (agent.isPending) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="px-7 pb-4 pt-7">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-2 h-4 w-96" />
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-7 w-72" />
            <Skeleton className="h-7 w-24" />
          </div>
        </div>
        <div className="px-7">
          <Skeleton className="h-96 w-full max-w-5xl rounded-xl" />
        </div>
      </div>
    );
  }

  if (!agent.isSuccess) {
    const status = (agent.error as { status?: number } | null)?.status;
    return (
      <div className="flex flex-1 flex-col">
        <EmptyState
          icon={AudioWaveform}
          title={status === 404 ? "Agent not found" : "Couldn't load this agent"}
          description={status === 404 ? "It may have been deleted, or the link is wrong." : errorMessage(agent.error)}
          action={
            <div className="flex gap-2">
              <Link href="/agents" className={buttonVariants({ variant: "outline" })}>
                <ArrowLeft /> All agents
              </Link>
              {status !== 404 ? <Button onClick={() => agent.refetch()}>Retry</Button> : null}
            </div>
          }
        />
      </div>
    );
  }

  const a = agent.data;
  const webhookOn = Boolean(a.postCallWebhook?.webhookId);
  const syncing = sync.isPending;

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title={a.name}
        description={a.description || "Voice agent"}
        actions={
          <>
            <Tip label="Pull the latest configuration from ElevenLabs (overwrites local settings)">
              <Button variant="outline" onClick={() => sync.mutate(a._id)} loading={syncing}>
                {!syncing ? <RefreshCw /> : null} Sync from ElevenLabs
              </Button>
            </Tip>
            <Link href={`/test?agent=${a._id}`} className={buttonVariants({ variant: "soft" })}>
              <FlaskConical /> Test call
            </Link>
            <Button variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => setConfirmDelete(true)}>
              <Trash2 /> Delete
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
          <Link href="/agents" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="size-3.5" /> All agents
          </Link>
          <span className="text-border">|</span>
          <span className="inline-flex items-center gap-1 rounded-md border border-border bg-card py-0.5 pl-2 pr-0.5 font-mono text-xs text-foreground">
            {a.elevenAgentId}
            <CopyButton value={a.elevenAgentId} label="Copy agent ID" size="xs" />
          </span>
          {a.lastProvider ? <Badge variant="info">via {providerLabel(a.lastProvider)}</Badge> : null}
          <Badge variant={webhookOn ? "success" : "secondary"}>
            <Webhook /> {webhookOn ? "Webhook on" : "Webhook off"}
          </Badge>
          <span>Last synced {relativeTime(a.lastSyncedAt)}</span>
          <span className="text-border">·</span>
          <span>{formatNumber(a.callCount)} calls</span>
          {a.lastCallAt ? (
            <>
              <span className="text-border">·</span>
              <span>Last call {relativeTime(a.lastCallAt)}</span>
            </>
          ) : null}
        </div>
      </PageHeader>

      <AgentForm key={`${a._id}:${a.updatedAt}`} mode="edit" initial={a} />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete “${a.name}”?`}
        description="This removes the agent from Matrix and from your ElevenLabs workspace. Past conversations are kept."
        confirmLabel="Delete agent"
        destructive
        loading={del.isPending}
        onConfirm={() => del.mutate(a._id, { onSuccess: () => router.push("/agents") })}
      />
    </div>
  );
}
