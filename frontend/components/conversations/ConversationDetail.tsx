"use client";
import { useEffect, useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bot, Building2, CircleAlert, Copy, FileText, MicOff, MoreHorizontal, PanelRight, PhoneCall, PhoneIncoming, PhoneOutgoing, RefreshCw, Sparkles, Trash2, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tip } from "@/components/ui/tooltip";
import { useAnalyzeConversation, useConversation, useConversationProfile, useDeleteConversation, useRefreshConversation } from "@/hooks/api";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { apiUrl, errorMessage } from "@/lib/api";
import { cn, formatDateTime, formatDuration } from "@/lib/utils";
import { AudioPlayer } from "./AudioPlayer";
import { Avatar } from "./ConversationList";
import { DetailsPanel } from "./DetailsPanel";
import { LeadProfilePanel, ProfileSkeleton } from "./LeadProfilePanel";
import { SummaryPanel } from "./SummaryPanel";
import { Transcript } from "./Transcript";
import { copyText, displayName, formatDisplayName, formatPhone, isLive, outcomeMeta, profileHasName, statusMeta } from "./helpers";

/** The profile rail appears from this viewport width; below it the same panel lives in a "Profile" tab. */
const RAIL_QUERY = "(min-width: 1280px)";
const RAIL_CLASS = "flex min-h-0 w-[320px] shrink-0 flex-col border-l border-border";
const PROFILE_OPEN_KEY = "pilot.conv.profileOpen";

type DetailTab = "profile" | "transcript" | "summary" | "details";

function readProfileOpen(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(PROFILE_OPEN_KEY) !== "0";
  } catch {
    return true;
  }
}
function writeProfileOpen(open: boolean) {
  try {
    window.localStorage.setItem(PROFILE_OPEN_KEY, open ? "1" : "0");
  } catch {}
}

/** `rail` reserves the profile column so nothing shifts when the conversation arrives. */
export function DetailSkeleton({ rail = false }: { rail?: boolean }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border px-6 py-5">
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
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 space-y-4 overflow-hidden px-6 py-5">
          <Skeleton className="h-[92px] w-full rounded-xl" />
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-14 w-3/4 rounded-2xl" />
          <Skeleton className="ml-auto h-12 w-1/2 rounded-2xl" />
          <Skeleton className="h-16 w-2/3 rounded-2xl" />
        </div>
        {rail ? (
          <aside className={RAIL_CLASS} aria-hidden>
            <ProfileSkeleton className="overflow-hidden px-5 py-5" />
          </aside>
        ) : null}
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

export function ConversationDetail({ id, onDeleted, onSelectConversation }: { id: string; onDeleted: (id: string) => void; onSelectConversation: (id: string) => void }) {
  const qc = useQueryClient();
  const railId = useId();
  const { data: c, isLoading, isError, error, refetch } = useConversation(id);
  const { data: profile } = useConversationProfile(id);
  const refresh = useRefreshConversation();
  const analyze = useAnalyzeConversation();
  const del = useDeleteConversation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const live = isLive(c?.status);

  // Profile: a right rail on wide screens (collapsible, remembered), a "Profile" tab below that.
  const isWide = useMediaQuery(RAIL_QUERY);
  const [profileOpen, setProfileOpen] = useState(readProfileOpen);
  const [tab, setTab] = useState<DetailTab>("transcript");
  const showRail = isWide && profileOpen;
  // The Profile tab does not exist on wide screens — fall back to the transcript if the viewport grows while it is active.
  const activeTab: DetailTab = isWide && tab === "profile" ? "transcript" : tab;
  useEffect(() => {
    if (isWide) setTab((t) => (t === "profile" ? "transcript" : t));
  }, [isWide]);
  const toggleProfile = () => {
    if (!isWide) {
      setTab((t) => (t === "profile" ? "transcript" : "profile"));
      return;
    }
    const next = !profileOpen;
    setProfileOpen(next);
    writeProfileOpen(next);
  };

  // Live calls: poll for updates (and what the call taught us about the caller) until the call lands.
  useEffect(() => {
    if (!live && c?.status !== "processing") return;
    const t = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["conversations", "one", id] });
      qc.invalidateQueries({ queryKey: ["conversations", "profile", id] });
    }, 10_000);
    return () => clearInterval(t);
  }, [live, c?.status, id, qc]);

  if (isLoading) return <DetailSkeleton rail={showRail} />;
  if (isError || !c) {
    return (
      <div className="flex min-h-0 flex-1 items-center-safe justify-center overflow-y-auto">
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
  // Who this is: the profile knows best (lead name → name captured in a call → phone); until it loads use the conversation itself.
  const rawName = profile?.displayName?.trim() || displayName(c);
  const name = formatDisplayName(rawName);
  const named = profile ? profileHasName(profile) : Boolean(c.leadName);
  const phone = profile?.phone || c.phone || "";
  const company = profile?.lead?.company?.trim();
  const profileShown = isWide ? profileOpen : activeTab === "profile";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-border px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar c={{ leadName: named ? rawName : undefined, phone: phone || undefined, status: c.status }} className="size-11 text-[15px]" />
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="min-w-0 max-w-full truncate font-heading text-[20px] leading-tight" title={name}>
                  {name}
                </h2>
                <Badge variant={status.variant} className={cn(live && "animate-pulse")}>
                  {status.label}
                </Badge>
                {c.status === "done" ? <Badge variant={outcome.variant}>{outcome.label}</Badge> : null}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] text-muted-foreground">
                {named && company ? (
                  <>
                    <span className="inline-flex min-w-0 max-w-[220px] items-center gap-1">
                      <Building2 className="size-3.5 shrink-0" strokeWidth={1.8} /> <span className="truncate">{company}</span>
                    </span>
                    <span aria-hidden>·</span>
                  </>
                ) : null}
                {named && phone ? (
                  <>
                    <span className="tabular-nums">{formatPhone(phone)}</span>
                    <span aria-hidden>·</span>
                  </>
                ) : null}
                <span className="inline-flex min-w-0 max-w-[220px] items-center gap-1">
                  <Bot className="size-3.5 shrink-0" strokeWidth={1.8} /> <span className="truncate">{c.agentName || "Agent"}</span>
                </span>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <Direction className="size-3.5" strokeWidth={1.8} /> {c.direction === "inbound" ? "Inbound" : c.direction === "outbound" ? "Outbound" : "Voice"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Tip label={profileShown ? "Hide profile" : "Show profile"}>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={toggleProfile}
                aria-label={profileShown ? "Hide profile" : "Show profile"}
                aria-pressed={profileShown}
                aria-controls={showRail ? railId : undefined}
                className={cn(profileShown && "bg-muted")}
              >
                {isWide ? <PanelRight /> : <UserRound />}
              </Button>
            </Tip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon-sm" aria-label="More actions" loading={refresh.isPending || analyze.isPending}>
                  {refresh.isPending || analyze.isPending ? null : <MoreHorizontal />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onSelect={() => refresh.mutate(c._id, { onSuccess: () => toast.success("Refreshed from Candex") })}>
                  <RefreshCw /> Refresh from Candex
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

      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="space-y-5 px-6 py-5">
            {c.hasAudio ? (
              <AudioPlayer src={apiUrl(`/conversations/${c._id}/audio`)} fallbackDuration={c.durationSecs} />
            ) : (
              <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                <MicOff className="size-4" strokeWidth={1.8} /> No recording (recording disabled or still processing)
              </div>
            )}

            <Tabs value={activeTab} onValueChange={(v) => setTab(v as DetailTab)}>
              <TabsList className="max-w-full overflow-x-auto [scrollbar-width:none]">
                {!isWide ? (
                  <TabsTrigger value="profile">
                    <UserRound /> Profile
                  </TabsTrigger>
                ) : null}
                <TabsTrigger value="transcript">
                  <FileText /> Transcript
                </TabsTrigger>
                <TabsTrigger value="summary">Summary & data</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
              </TabsList>
              {!isWide ? (
                <TabsContent value="profile">
                  <LeadProfilePanel conversationId={id} onSelectConversation={onSelectConversation} variant="tab" />
                </TabsContent>
              ) : null}
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
        {showRail ? (
          <aside id={railId} aria-label="Caller profile" className={RAIL_CLASS}>
            <LeadProfilePanel conversationId={id} onSelectConversation={onSelectConversation} variant="rail" />
          </aside>
        ) : null}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Delete this conversation?</DialogTitle>
            <DialogDescription>
              This removes the call with {name} from Pilot. The recording and transcript stay on Candex.
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
