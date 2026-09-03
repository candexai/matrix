"use client";
import { useState } from "react";
import { CloudDownload, Network, Phone, RefreshCw, TriangleAlert } from "lucide-react";
import type { PhoneNumber } from "@/lib/types";
import { useAgents, useDeletePhoneNumber, usePhoneNumbers } from "@/hooks/api";
import { errorMessage } from "@/lib/api";
import { ConfirmDialog } from "@/components/agents/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectSipDialog } from "./ConnectSipDialog";
import { EditPhoneNumberDialog } from "./EditPhoneNumberDialog";
import { ImportTwilioDialog } from "./ImportTwilioDialog";
import { PhoneNumbersTable } from "./PhoneNumbersTable";
import { providerMeta } from "./phone-utils";

const DESCRIPTION = "Numbers your agents call from. Import a Twilio number or connect a SIP trunk; assign a number to an agent for inbound calls.";

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="h-10 border-b border-border bg-muted/70" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="grid grid-cols-[1.2fr_0.6fr_0.9fr_1.1fr_1.3fr_48px] items-center gap-3 border-b border-border px-3 py-3 last:border-0">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
          <div className="flex gap-1">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-18 rounded-full" />
          </div>
          <Skeleton className="h-8 w-44" />
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-44" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="size-8 justify-self-end" />
        </div>
      ))}
    </div>
  );
}

export function PhoneNumbersPageSkeleton() {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Phone Numbers" description={DESCRIPTION} />
      <div className="px-7 pb-8">
        <Skeleton className="mb-4 h-4 w-80" />
        <TableSkeleton />
      </div>
    </div>
  );
}

export function PhoneNumbersPage() {
  const numbers = usePhoneNumbers();
  const agents = useAgents();
  const del = useDeletePhoneNumber();
  const [twilioOpen, setTwilioOpen] = useState(false);
  const [sipOpen, setSipOpen] = useState(false);
  const [editing, setEditing] = useState<PhoneNumber | null>(null);
  const [removing, setRemoving] = useState<PhoneNumber | null>(null);

  const list = numbers.data ?? [];
  const total = list.length;

  const importButtons = (
    <>
      <Button variant="outline" onClick={() => setTwilioOpen(true)}>
        <CloudDownload /> Import Twilio number
      </Button>
      <Button onClick={() => setSipOpen(true)}>
        <Network /> Connect SIP trunk
      </Button>
    </>
  );

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Phone Numbers" description={DESCRIPTION} actions={importButtons}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-muted-foreground">Numbers are stored in your ElevenLabs workspace; Matrix reads them live.</p>
          {numbers.isSuccess ? (
            <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
              <span>
                {total} {total === 1 ? "number" : "numbers"}
              </span>
              <Button variant="ghost" size="xs" onClick={() => numbers.refetch()} disabled={numbers.isFetching}>
                <RefreshCw className={numbers.isFetching ? "animate-spin" : undefined} /> Refresh
              </Button>
            </div>
          ) : null}
        </div>
      </PageHeader>

      <div className="px-7 pb-8">
        {numbers.isPending ? (
          <TableSkeleton />
        ) : numbers.isError ? (
          <EmptyState
            icon={TriangleAlert}
            title="Couldn't reach ElevenLabs"
            description={errorMessage(numbers.error)}
            action={
              <Button variant="outline" onClick={() => numbers.refetch()} loading={numbers.isFetching}>
                {!numbers.isFetching ? <RefreshCw /> : null} Retry
              </Button>
            }
          />
        ) : total === 0 ? (
          <EmptyState icon={Phone} title="No phone numbers yet" description="Import a number you already own in Twilio, or connect a SIP trunk from your carrier or PBX. Agents need an outbound-capable number to place calls." action={<div className="flex flex-wrap justify-center gap-2">{importButtons}</div>} />
        ) : (
          <PhoneNumbersTable numbers={list} agents={agents.data} agentsLoading={agents.isPending} onEdit={setEditing} onRemove={setRemoving} />
        )}
      </div>

      <ImportTwilioDialog open={twilioOpen} onOpenChange={setTwilioOpen} agents={agents.data} agentsLoading={agents.isPending} />
      <ConnectSipDialog open={sipOpen} onOpenChange={setSipOpen} agents={agents.data} agentsLoading={agents.isPending} />
      <EditPhoneNumberDialog number={editing} open={Boolean(editing)} onOpenChange={(o) => (!o ? setEditing(null) : undefined)} />
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(o) => (!o ? setRemoving(null) : undefined)}
        title={`Remove ${removing?.phone_number ?? "number"}?`}
        description={
          removing
            ? `This detaches the number from your ElevenLabs workspace${removing.assigned_agent ? ` and unassigns it from ${removing.assigned_agent.agent_name}` : ""}. ${providerMeta(removing.provider).label === "Twilio" ? "The number stays in your Twilio account." : "Your SIP trunk configuration is deleted; your carrier isn't affected."} Past conversations are kept.`
            : undefined
        }
        confirmLabel="Remove number"
        destructive
        loading={del.isPending}
        onConfirm={() => (removing ? del.mutate(removing.phone_number_id, { onSuccess: () => setRemoving(null) }) : undefined)}
      />
    </div>
  );
}
