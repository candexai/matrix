"use client";
import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Info, KeyRound, MoreHorizontal, RefreshCw, Unplug, User } from "lucide-react";
import { toast } from "sonner";
import type { ElevenLabsStatus, IntegrationItem } from "@/lib/types";
import { useDisconnectEleven, useElevenStatus } from "@/hooks/api";
import { errorMessage } from "@/lib/api";
import { cn, formatDateTime, formatNumber, relativeTime, titleCase } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tip } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/leads/ConfirmDialog";
import { IntegrationCardShell, type CardStatus } from "./IntegrationCard";
import { ElevenLabsConnectDialog, type ConnectDialogMode } from "./ElevenLabsConnectDialog";

const REGION_LABEL: Record<NonNullable<ElevenLabsStatus["region"]>, string> = { us: "US", eu: "EU · data residency" };

function cardStatus(s?: ElevenLabsStatus): CardStatus {
  if (!s?.configured) return "setup";
  return s.source === "env" ? "server-key" : "connected";
}

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const tone = pct >= 90 ? "bg-destructive" : pct >= 75 ? "bg-amber-500" : "bg-primary";
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">Characters this cycle</span>
        <span className="tabular-nums">
          {formatNumber(used)} / {formatNumber(limit)} · {pct}%
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Character usage" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn("h-full rounded-full transition-[width]", tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Per-workspace ElevenLabs connection: own API key, region, account tier and character usage. */
export function ElevenLabsCard({ item }: { item: IntegrationItem }) {
  const status = useElevenStatus();
  const disconnect = useDisconnectEleven();
  const s = status.data;
  const [dialog, setDialog] = useState<ConnectDialogMode | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const connectDialog = <ElevenLabsConnectDialog open={dialog !== null} mode={dialog ?? "connect"} onOpenChange={(o) => (!o ? setDialog(null) : undefined)} />;
  const refresh = async () => {
    const r = await status.refetch();
    if (r.error) toast.error(errorMessage(r.error));
    else toast.message("ElevenLabs status refreshed");
  };

  if (status.isLoading) {
    return (
      <IntegrationCardShell id="elevenlabs" name={item.name} status="disconnected">
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-9 w-40" />
        </div>
      </IntegrationCardShell>
    );
  }

  if (status.error || !s) {
    return (
      <IntegrationCardShell
        id="elevenlabs"
        name={item.name}
        status="error"
        footer={
          <Button variant="outline" size="sm" onClick={() => status.refetch()}>
            <RefreshCw /> Retry
          </Button>
        }
      >
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <span>{status.error ? errorMessage(status.error) : "Could not load ElevenLabs status."}</span>
        </div>
      </IntegrationCardShell>
    );
  }

  // ---- not connected ----
  if (!s.configured) {
    return (
      <IntegrationCardShell
        id="elevenlabs"
        name={item.name}
        status="setup"
        className="sm:col-span-2"
        footer={
          <>
            <Button size="sm" onClick={() => setDialog("connect")}>
              <KeyRound /> Connect ElevenLabs
            </Button>
            <span className="text-xs text-muted-foreground">Paste an API key from your ElevenLabs account — about a minute.</span>
          </>
        }
      >
        <div className="space-y-2 text-[13px]">
          <p className="text-muted-foreground">Bring your own ElevenLabs account: agents, voices, phone numbers and calls run through it and count towards its plan.</p>
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
            <Info className="mt-0.5 size-4 shrink-0" />
            <div>No API key is connected to this workspace yet. Voice Agents, Phone Numbers and AI Test stay locked until you add one.</div>
          </div>
        </div>
        {connectDialog}
      </IntegrationCardShell>
    );
  }

  // ---- connected (own key) or falling back to the server key ----
  const usingEnv = s.source === "env";
  const acct = s.account;
  return (
    <>
      <IntegrationCardShell
        id="elevenlabs"
        name={item.name}
        status={cardStatus(s)}
        footer={
          <>
            {usingEnv ? (
              <Button size="sm" onClick={() => setDialog("connect")}>
                <KeyRound /> Add your own key
              </Button>
            ) : null}
            <Link href="/agents" className={buttonVariants({ variant: usingEnv ? "outline" : "default", size: "sm" })}>
              Manage agents <ArrowUpRight />
            </Link>
            <div className="ml-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="More">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setDialog("replace")}>
                    <KeyRound /> Replace key
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void refresh()} disabled={status.isFetching}>
                    <RefreshCw /> Refresh status
                  </DropdownMenuItem>
                  {!usingEnv ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem destructive onSelect={() => setConfirmDisconnect(true)}>
                        <Unplug /> Disconnect
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-[13px]">
            <div className="flex flex-wrap items-center gap-2">
              <User className="size-3.5 text-muted-foreground" />
              <span className="font-medium">{acct?.name || "ElevenLabs account"}</span>
              {acct?.tier ? <Badge variant="soft">{titleCase(acct.tier)}</Badge> : null}
              {s.connectedAt ? (
                <Tip label={formatDateTime(s.connectedAt)}>
                  <span className="ml-auto text-xs text-muted-foreground">Connected {relativeTime(s.connectedAt)}</span>
                </Tip>
              ) : null}
            </div>
            {acct?.characterLimit ? (
              <div className="mt-2.5">
                <UsageBar used={acct.characterCount ?? 0} limit={acct.characterLimit} />
              </div>
            ) : typeof acct?.characterCount === "number" ? (
              <p className="mt-1 text-xs text-muted-foreground">{formatNumber(acct.characterCount)} characters used this cycle</p>
            ) : null}
          </div>

          {usingEnv ? (
            <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5 text-[13px] text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">
              <Info className="mt-0.5 size-4 shrink-0" />
              <span>This workspace uses the key configured on the server; add your own key to override.</span>
            </div>
          ) : null}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
            <dt className="text-muted-foreground">API key</dt>
            <dd className="truncate text-right font-mono text-[12px]">{s.keyHint ?? "••••"}</dd>
            <dt className="text-muted-foreground">Region</dt>
            <dd className="text-right">{s.region ? REGION_LABEL[s.region] : "—"}</dd>
            {s.baseUrl ? (
              <>
                <dt className="text-muted-foreground">API base</dt>
                <dd className="truncate text-right font-mono text-[12px]" title={s.baseUrl}>
                  {s.baseUrl.replace(/^https?:\/\//, "")}
                </dd>
              </>
            ) : null}
          </dl>
        </div>
      </IntegrationCardShell>

      {connectDialog}
      <ConfirmDialog
        open={confirmDisconnect}
        onOpenChange={(o) => (!disconnect.isPending ? setConfirmDisconnect(o) : undefined)}
        title="Disconnect ElevenLabs?"
        description="Removes the API key from this workspace. Your agents, phone numbers and voices stay in your ElevenLabs account — they just disappear from Matrix until you reconnect. Conversations already stored here are kept."
        confirmLabel="Disconnect"
        destructive
        loading={disconnect.isPending}
        onConfirm={() => disconnect.mutate(undefined, { onSuccess: () => setConfirmDisconnect(false) })}
      />
    </>
  );
}
