"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Copy, ExternalLink, Info, Loader2, MoreHorizontal, RefreshCw, Table2, Unplug, Building2, Mail, User } from "lucide-react";
import { toast } from "sonner";
import type { IntegrationItem, ZohoStatus } from "@/lib/types";
import { useZohoConnect, useZohoDisconnect, useZohoStatus, useZohoSync } from "@/hooks/api";
import { errorMessage } from "@/lib/api";
import { formatDateTime, formatDuration, relativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tip } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/leads/ConfirmDialog";
import { IntegrationCardShell, type CardStatus } from "./IntegrationCard";

function cardStatus(s?: ZohoStatus): CardStatus {
  if (!s) return "disconnected";
  if (!s.configured) return "setup";
  if (s.connected) return s.syncStatus === "error" || s.status === "error" ? "error" : "connected";
  return s.status === "error" ? "error" : "disconnected";
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
/** Hostname of the OAuth redirect URI when it points at a machine other than this one (null otherwise). */
function remoteRedirectHost(uri?: string | null): string | null {
  if (!uri) return null;
  try {
    const host = new URL(uri).hostname;
    return host && !LOCAL_HOSTS.has(host) ? host : null;
  } catch {
    return null;
  }
}

function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <Tip label={done ? "Copied" : "Copy"}>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(value).then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          });
        }}
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Copy"
      >
        {done ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      </button>
    </Tip>
  );
}

function MonoBox({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5">
      <code className="min-w-0 flex-1 truncate font-mono text-[12px]" title={value}>
        {value}
      </code>
      <CopyButton value={value} />
    </div>
  );
}

export function ZohoCard({ item }: { item: IntegrationItem }) {
  const sync = useZohoSync();
  const connect = useZohoConnect();
  const disconnect = useZohoDisconnect();
  const [running, setRunning] = useState(false);
  const status = useZohoStatus({ refetchInterval: running || sync.isPending ? 2000 : false });
  const s = status.data;
  const syncing = sync.isPending || s?.syncStatus === "running";
  useEffect(() => setRunning(s?.syncStatus === "running"), [s?.syncStatus]);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const st = cardStatus(s);

  if (status.isLoading) {
    return (
      <IntegrationCardShell id="zoho" name={item.name} status="disconnected">
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
        id="zoho"
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
          <span>{status.error ? errorMessage(status.error) : "Could not load Zoho status."}</span>
        </div>
      </IntegrationCardShell>
    );
  }

  // ---- not configured ----
  if (!s.configured) {
    return (
      <IntegrationCardShell
        id="zoho"
        name={item.name}
        status="setup"
        className="sm:col-span-2"
        footer={
          <>
            <Tip label="Add the client id and secret to backend/.env first">
              <span className="inline-flex" tabIndex={0}>
                <Button size="sm" disabled>
                  Connect Zoho CRM
                </Button>
              </span>
            </Tip>
            <a href="https://api-console.zoho.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              Open Zoho API console <ExternalLink className="size-3" />
            </a>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-[13px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              Add <code className="font-mono text-[12px]">ZOHO_CLIENT_ID</code> and <code className="font-mono text-[12px]">ZOHO_CLIENT_SECRET</code> to <code className="font-mono text-[12px]">backend/.env</code> to enable this integration.
            </span>
          </div>
          <ol className="space-y-2.5 text-[13px]">
            <li className="flex gap-2.5">
              <Step n={1} />
              <span>
                Create a <strong>Server-based application</strong> at{" "}
                <a href="https://api-console.zoho.com" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  api-console.zoho.com
                </a>
                .
              </span>
            </li>
            <li className="flex gap-2.5">
              <Step n={2} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <span>Set the Authorized Redirect URI to:</span>
                <MonoBox value={s.redirectUri} />
              </div>
            </li>
            <li className="flex gap-2.5">
              <Step n={3} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <span>
                  Make sure <code className="font-mono text-[12px]">ZOHO_ACCOUNTS_URL</code> matches your data center (currently):
                </span>
                <MonoBox value={s.accountsUrl} />
              </div>
            </li>
            <li className="flex gap-2.5">
              <Step n={4} />
              <span>Paste the Client ID and Client Secret into the backend .env and restart the backend.</span>
            </li>
          </ol>
        </div>
      </IntegrationCardShell>
    );
  }

  // ---- configured, not connected ----
  if (!s.connected) {
    const redirectHost = remoteRedirectHost(s.redirectUri);
    const thisHost = typeof window !== "undefined" ? window.location.hostname : "";
    // Same host as the app → Zoho must have this exact callback registered on the client.
    // Different host (e.g. production callback used from a laptop) → use the local bridge.
    const remoteHost = redirectHost && redirectHost !== thisHost ? redirectHost : null;
    const sameHost = Boolean(redirectHost) && redirectHost === thisHost;
    return (
      <IntegrationCardShell
        id="zoho"
        name={item.name}
        status={st}
        footer={
          <>
            <Button size="sm" onClick={() => connect.mutate()} loading={connect.isPending}>
              Connect Zoho CRM
            </Button>
            <span className="text-xs text-muted-foreground">You’ll be redirected to Zoho to authorize access to Leads.</span>
          </>
        }
      >
        <div className="space-y-2 text-[13px]">
          {s.status === "revoked" ? <p className="text-muted-foreground">Access was revoked. Reconnect to resume syncing.</p> : null}
          {s.syncError ? (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <span>{s.syncError}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Redirect URI</span>
            <code className="truncate font-mono text-[12px]" title={s.redirectUri}>
              {s.redirectUri}
            </code>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Accounts server</span>
            <code className="truncate font-mono text-[12px]">{s.accountsUrl}</code>
          </div>
          {s.leadCount ? (
            <p className="text-muted-foreground">
              {s.leadCount} previously synced lead{s.leadCount === 1 ? "" : "s"} are still available in My Leads.
            </p>
          ) : null}
          {sameHost ? (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
              <Info className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="font-medium">This callback URL must be registered on the Zoho app</div>
                <p>
                  If Zoho answers <em>Invalid Redirect Uri</em>, add the URL below under <strong>Authorized Redirect URIs</strong> for the client in the Zoho API console (India DC: api-console.zoho.in), save, then click Connect again.
                </p>
                <MonoBox value={s.redirectUri} />
                <p className="text-xs opacity-80">Alternative without console access: connect from a laptop with <code className="font-mono">npm run zoho:bridge</code> — the tokens are shared with this site.</p>
              </div>
            </div>
          ) : null}
          {remoteHost ? (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5 text-[13px] text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">
              <Info className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="font-medium">Redirect URI points at another server</div>
                <p>
                  Zoho will send the login callback to <code className="font-mono text-[12px]">{remoteHost}</code>. To connect from this machine, run the local bridge and click Connect inside the Chrome window it opens:
                </p>
                <MonoBox value="npm run zoho:bridge" />
                <p className="text-xs opacity-80">Keep that terminal running until you’re redirected back here.</p>
              </div>
            </div>
          ) : null}
        </div>
      </IntegrationCardShell>
    );
  }

  // ---- connected ----
  const stats = s.lastSyncStats;
  return (
    <>
      <IntegrationCardShell
        id="zoho"
        name={item.name}
        status={st}
        footer={
          <>
            <Button size="sm" onClick={() => sync.mutate({ full: false })} loading={syncing} disabled={syncing}>
              {!syncing ? <RefreshCw /> : null}
              {syncing ? "Syncing…" : "Sync now"}
            </Button>
            <Link href="/leads" className="inline-flex items-center gap-1 text-[13px] text-primary hover:underline">
              <Table2 className="size-3.5" /> Open My Leads
            </Link>
            <div className="ml-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="More">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => sync.mutate({ full: true })} disabled={syncing}>
                    <RefreshCw /> Full re-sync
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/leads">
                      <Table2 /> Open My Leads
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive onSelect={() => setConfirmDisconnect(true)}>
                    <Unplug /> Disconnect
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-[13px]">
            <div className="flex items-center gap-2">
              <User className="size-3.5 text-muted-foreground" />
              <span className="font-medium">{s.profile?.fullName || "Zoho user"}</span>
              <span className="ml-auto text-xs text-muted-foreground">Connected {relativeTime(s.connectedAt)}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
              {s.profile?.email ? (
                <span className="inline-flex items-center gap-1">
                  <Mail className="size-3" /> {s.profile.email}
                </span>
              ) : null}
              {s.profile?.orgName ? (
                <span className="inline-flex items-center gap-1">
                  <Building2 className="size-3" /> {s.profile.orgName}
                </span>
              ) : null}
            </div>
          </div>

          {syncing ? (
            <div className="rounded-md border border-primary/30 bg-accent-tint/40 px-3 py-2 text-[13px]">
              <div className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin text-primary" />
                <span>Syncing leads from Zoho…</span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-primary/15">
                <div className="h-full w-1/3 animate-[zoho-progress_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
              </div>
              <style href="zoho-progress-anim" precedence="default">{`@keyframes zoho-progress{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
            </div>
          ) : null}

          {s.syncError && !syncing ? (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px]">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div className="min-w-0">
                <div className="font-medium text-destructive">Last sync failed</div>
                <div className="break-words text-muted-foreground">{s.syncError}</div>
              </div>
            </div>
          ) : null}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
            <dt className="text-muted-foreground">Leads in Matrix</dt>
            <dd className="text-right tabular-nums">{new Intl.NumberFormat("en-US").format(s.leadCount ?? 0)}</dd>
            <dt className="text-muted-foreground">Last sync</dt>
            <dd className="text-right">
              {s.lastSyncAt ? (
                <Tip label={formatDateTime(s.lastSyncAt)}>
                  <span>{relativeTime(s.lastSyncAt)}</span>
                </Tip>
              ) : (
                <span className="text-muted-foreground">Never — click Sync now</span>
              )}
            </dd>
            {stats ? (
              <>
                <dt className="text-muted-foreground">Last result</dt>
                <dd className="text-right tabular-nums">
                  {stats.fetched} fetched · {stats.created} new · {stats.updated} updated
                  <span className="text-muted-foreground"> · {formatDuration(Math.round(stats.durationMs / 1000))}</span>
                </dd>
              </>
            ) : null}
            {s.apiDomain ? (
              <>
                <dt className="text-muted-foreground">API domain</dt>
                <dd className="truncate text-right font-mono text-[12px]">{s.apiDomain}</dd>
              </>
            ) : null}
          </dl>
        </div>
      </IntegrationCardShell>

      <ConfirmDialog
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
        title="Disconnect Zoho CRM?"
        description="Revokes Matrix’s access token. Leads already synced stay in My Leads, but syncing and write-back stop until you reconnect."
        confirmLabel="Disconnect"
        destructive
        loading={disconnect.isPending}
        onConfirm={() =>
          disconnect.mutate(undefined, {
            onSuccess: () => {
              setConfirmDisconnect(false);
              toast.message("You can reconnect at any time from this card.");
            },
          })
        }
      />
    </>
  );
}

function Step({ n }: { n: number }) {
  return <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-tint font-heading text-[11px] text-primary-hover">{n}</span>;
}
