"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bot, CircleAlert, Copy, ExternalLink, FileText, MicOff, MoreHorizontal, PhoneCall, PhoneIncoming, PhoneOutgoing, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAnalyzeConversation, useConversation, useDeleteConversation, useRefreshConversation } from "@/hooks/api";
import { apiUrl, errorMessage } from "@/lib/api";
import { cn, formatDateTime, formatDuration } from "@/lib/utils";
import { AudioPlayer } from "./AudioPlayer";
import { Avatar } from "./ConversationList";
import { DetailsPanel } from "./DetailsPanel";
import { SummaryPanel } from "./SummaryPanel";
import { Transcript } from "./Transcript";
import { copyText, displayName, isLive, outcomeMeta, statusMeta } from "./helpers";

export function DetailSkeleton() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-border px-6 py-5">
        <div className="flex items-center gap-3">
          <Skeleton className="size-11 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3.5 w-64" />
          </div>
        </div>
        <div className="mt-4 flex gap-8">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="space-y-4 px-6 py-5">
        <Skeleton className="h-[92px] w-full rounded-xl" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-14 w-3/4 rounded-2xl" />
        <Skeleton className="ml-auto h-12 w-1/2 rounded-2xl" />
        <Skeleton className="h-16 w-2/3 rounded-2xl" />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-[13.5px]">{value}</div>
    </div>
  );
}

export function ConversationDetail({ id, onDeleted }: { id: string; onDeleted: (id: string) => void }) {
  const qc = useQueryClient();
  const { data: c, isLoading, isError, error, refetch } = useConversation(id);
  const refresh = useRefreshConversation();
  const analyze = useAnalyzeConversation();
  const del = useDeleteConversation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const live = isLive(c?.status);

  // Live calls: poll for updates until the call lands.
  useEffect(() => {
    if (!live && c?.status !== "processing") return;
    const t = setInterval(() => qc.invalidateQueries({ queryKey: ["conversations", "one", id] }), 10_000);
    return () => clearInterval(t);
  }, [live, c?.status, id, qc]);

  if (isLoading) return <DetailSkeleton />;
  if (isError || !c) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          icon={CircleAlert}
          title="Conversation not found"
          description={isError ? errorMessage(error) : "It may have been deleted."}
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  const status = statusMeta(c.status);
  const outcome = outcomeMeta(c.callSuccessful);
  const Direction = c.direction === "inbound" ? PhoneIncoming : c.direction === "outbound" ? PhoneOutgoing : PhoneCall;
  const name = displayName(c);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-border px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar c={c} className="size-11 text-[15px]" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate font-heading text-[20px] leading-tight">{name}</h2>
                <Badge variant={status.variant} className={cn(live && "animate-pulse")}>
                  {status.label}
                </Badge>
                {c.status === "done" ? <Badge variant={outcome.variant}>{outcome.label}</Badge> : null}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] text-muted-foreground">
                {c.leadName && c.phone ? (
                  <>
                    <span>{c.phone}</span>
                    <span aria-hidden>·</span>
                  </>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  <Bot className="size-3.5" strokeWidth={1.8} /> {c.agentName || "Agent"}
                </span>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <Direction className="size-3.5" strokeWidth={1.8} /> {c.direction === "inbound" ? "Inbound" : c.direction === "outbound" ? "Outbound" : "Voice"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {c.leadId ? (
              <Link href={`/leads?open=${encodeURIComponent(c.leadId)}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                <ExternalLink /> Open lead
              </Link>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon-sm" aria-label="More actions" loading={refresh.isPending || analyze.isPending}>
                  {refresh.isPending || analyze.isPending ? null : <MoreHorizontal />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onSelect={() => refresh.mutate(c._id, { onSuccess: () => toast.success("Refreshed from ElevenLabs") })}>
                  <RefreshCw /> Refresh from ElevenLabs
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => analyze.mutate({ id: c._id, force: true })} disabled={c.status !== "done"}>
                  <Sparkles /> Re-analyse insights
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => copyText(c.elevenConversationId, "Conversation ID copied")}>
                  <Copy /> Copy conversation ID
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onSelect={() => setConfirmOpen(true)}>
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-6 sm:grid-cols-4">
          <Stat label="Started" value={formatDateTime(c.startedAt || c.createdAt)} />
          <Stat label="Duration" value={<span className="tabular-nums">{formatDuration(c.durationSecs)}</span>} />
          <Stat label="Ended" value={c.endedAt ? formatDateTime(c.endedAt) : live ? "In progress" : "—"} />
          <Stat label="Transcript" value={`${c.transcript?.length ?? 0} turn${c.transcript?.length === 1 ? "" : "s"}`} />
        </dl>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-5 px-6 py-5">
          {c.hasAudio ? (
            <AudioPlayer src={apiUrl(`/conversations/${c._id}/audio`)} fallbackDuration={c.durationSecs} />
          ) : (
            <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
              <MicOff className="size-4" strokeWidth={1.8} /> No recording (recording disabled or still processing)
            </div>
          )}

          <Tabs defaultValue="transcript">
            <TabsList>
              <TabsTrigger value="transcript">
                <FileText /> Transcript
              </TabsTrigger>
              <TabsTrigger value="summary">Summary & data</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>
            <TabsContent value="transcript">
              <Transcript turns={c.transcript ?? []} agentLabel={c.agentName || "Agent"} />
            </TabsContent>
            <TabsContent value="summary">
              <SummaryPanel c={c} />
            </TabsContent>
            <TabsContent value="details">
              <DetailsPanel c={c} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Delete this conversation?</DialogTitle>
            <DialogDescription>
              This removes the call with {name} from Matrix. The recording and transcript stay on ElevenLabs.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={del.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={del.isPending}
              onClick={() =>
                del.mutate(c._id, {
                  onSuccess: () => {
                    setConfirmOpen(false);
                    onDeleted(c._id);
                  },
                })
              }
            >
              <Trash2 /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
