"use client";
import { useMemo, useState } from "react";
import { Check, Download, RefreshCw, Search, TriangleAlert } from "lucide-react";
import { useImportAgent, useRemoteAgents } from "@/hooks/api";
import { errorMessage } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUnix } from "./agent-utils";

export function ImportAgentsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const remote = useRemoteAgents(open);
  const importMut = useImportAgent();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = remote.data ?? [];
    return needle ? list.filter((r) => r.name.toLowerCase().includes(needle) || r.agent_id.toLowerCase().includes(needle)) : list;
  }, [remote.data, q]);

  const importedCount = (remote.data ?? []).filter((r) => r.imported).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Import from ElevenLabs</DialogTitle>
          <DialogDescription>Agents in your ElevenLabs workspace that aren't in Matrix yet. Importing pulls the full configuration.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or agent ID" className="pl-8" />
            </div>
            <Button variant="outline" size="icon" onClick={() => remote.refetch()} disabled={remote.isFetching} aria-label="Refresh">
              <RefreshCw className={remote.isFetching ? "animate-spin" : undefined} />
            </Button>
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            {remote.isPending ? (
              <div className="divide-y divide-border">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-64" />
                    </div>
                    <Skeleton className="h-8 w-20" />
                  </div>
                ))}
              </div>
            ) : remote.isError ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <TriangleAlert className="size-5 text-warning" />
                <p className="text-sm">{errorMessage(remote.error)}</p>
                <Button variant="outline" size="sm" onClick={() => remote.refetch()}>
                  Try again
                </Button>
              </div>
            ) : rows.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">{q ? "No agents match your search." : "No agents found in your ElevenLabs workspace."}</div>
            ) : (
              <div className="max-h-[50vh] divide-y divide-border overflow-y-auto">
                {rows.map((r) => {
                  const importing = importMut.isPending && importMut.variables === r.agent_id;
                  return (
                    <div key={r.agent_id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{r.name || "Untitled agent"}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                          <span className="font-mono">{r.agent_id}</span>
                          <span>· Created {formatUnix(r.created_at_unix_secs)}</span>
                        </div>
                      </div>
                      {r.imported ? (
                        <Badge variant="success">
                          <Check /> Imported
                        </Badge>
                      ) : (
                        <Button size="sm" variant="outline" loading={importing} disabled={importMut.isPending && !importing} onClick={() => importMut.mutate(r.agent_id)}>
                          {!importing ? <Download /> : null} Import
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogBody>
        <DialogFooter className="justify-between">
          <span className="text-xs text-muted-foreground">
            {remote.data ? `${remote.data.length} remote · ${importedCount} already imported` : ""}
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
