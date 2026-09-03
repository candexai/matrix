"use client";
import { RefreshCw } from "lucide-react";
import type { ZohoStatus } from "@/lib/types";
import { useZohoSync } from "@/hooks/api";
import { relativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/ui/tooltip";
import { formatCount } from "./leadUtils";

/** "Last sync 2h ago · 120 leads · 6 lists" from the Zoho status, or null when not connected. */
export function zohoSyncCaption(zoho?: ZohoStatus | null): string | null {
  if (!zoho?.connected) return null;
  if (!zoho.lastSyncAt) return "Never synced";
  const parts = [`Last sync ${relativeTime(zoho.lastSyncAt)}`, `${formatCount(zoho.leadCount ?? 0)} lead${zoho.leadCount === 1 ? "" : "s"}`];
  const lists = zoho.lastSyncStats?.lists;
  if (typeof lists === "number") parts.push(`${formatCount(lists)} list${lists === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

/** Sync caption + "Sync from Zoho" button shared by the lists overview and the table page. */
export function ZohoSyncAction({ zoho, zohoLoading }: { zoho?: ZohoStatus | null; zohoLoading?: boolean }) {
  const sync = useZohoSync();
  const connected = Boolean(zoho?.connected);
  const syncing = sync.isPending || zoho?.syncStatus === "running";
  const caption = zohoSyncCaption(zoho);
  return (
    <>
      {caption ? <span className="mr-1 hidden text-xs text-muted-foreground lg:inline">{caption}</span> : null}
      {connected ? (
        <Button variant="secondary" onClick={() => sync.mutate({ full: false })} loading={syncing} disabled={syncing}>
          {!syncing ? <RefreshCw /> : null}
          {syncing ? "Syncing…" : "Sync from Zoho"}
        </Button>
      ) : (
        <Tip label={zohoLoading ? "Checking Zoho connection…" : "Connect Zoho in Integrations"}>
          <span className="inline-flex" tabIndex={0}>
            <Button variant="secondary" disabled>
              <RefreshCw /> Sync from Zoho
            </Button>
          </span>
        </Tip>
      )}
    </>
  );
}
