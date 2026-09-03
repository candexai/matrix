"use client";
import { Loader2, MoreHorizontal, Pencil, PhoneIncoming, PhoneOutgoing, Trash2, UserRoundMinus } from "lucide-react";
import { toast } from "sonner";
import type { Agent, PhoneNumber } from "@/lib/types";
import { useUpdatePhoneNumber } from "@/hooks/api";
import { CopyButton } from "@/components/agents/CopyButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tip } from "@/components/ui/tooltip";
import { AgentSelect } from "./AgentSelect";
import { isSipNumber, outboundConfig, providerMeta } from "./phone-utils";

function Capabilities({ n }: { n: PhoneNumber }) {
  const inbound = n.supports_inbound !== false;
  const outbound = n.supports_outbound !== false;
  if (!inbound && !outbound) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {inbound ? (
        <Badge variant="outline">
          <PhoneIncoming /> Inbound
        </Badge>
      ) : null}
      {outbound ? (
        <Badge variant="outline">
          <PhoneOutgoing /> Outbound
        </Badge>
      ) : null}
    </div>
  );
}

function TrunkDetails({ n }: { n: PhoneNumber }) {
  if (!isSipNumber(n)) return <span className="text-xs text-muted-foreground">Routing managed by {providerMeta(n.provider).label}</span>;
  const o = outboundConfig(n);
  const i = n.inbound_trunk;
  const auth = o?.has_auth_credentials ? `auth as ${o.username || "user"}` : "no auth";
  return (
    <div className="min-w-0 space-y-0.5">
      {o?.address ? (
        <div className="truncate font-mono text-[12.5px]" title={o.address}>
          {o.address}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">No outbound trunk</div>
      )}
      {o?.address ? (
        <div className="text-xs text-muted-foreground">
          {(o.transport ?? "auto").toUpperCase()} · SRTP {o.media_encryption ?? "allowed"} · {auth}
        </div>
      ) : null}
      {i?.allowed_addresses?.length ? (
        <div className="truncate text-xs text-muted-foreground" title={i.allowed_addresses.join(", ")}>
          Inbound from {i.allowed_addresses.join(", ")}
          {i.allowed_numbers?.length ? ` · ${i.allowed_numbers.length} allowed number${i.allowed_numbers.length === 1 ? "" : "s"}` : ""}
          {i.has_auth_credentials ? " · auth" : ""}
        </div>
      ) : null}
    </div>
  );
}

export function PhoneNumbersTable({ numbers, agents, agentsLoading, onEdit, onRemove }: { numbers: PhoneNumber[]; agents?: Agent[]; agentsLoading?: boolean; onEdit: (n: PhoneNumber) => void; onRemove: (n: PhoneNumber) => void }) {
  const update = useUpdatePhoneNumber();
  const busyId = update.isPending ? update.variables?.id : undefined;

  const assign = (n: PhoneNumber, elevenAgentId: string) => {
    const next = elevenAgentId || null;
    if ((n.assigned_agent?.agent_id ?? null) === next) return;
    update.mutate({ id: n.phone_number_id, agent_id: next });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[24%]">Number</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Capabilities</TableHead>
            <TableHead className="w-[22%]">Assigned agent</TableHead>
            <TableHead className="w-[26%]">Trunk</TableHead>
            <TableHead className="w-12 text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {numbers.map((n) => {
            const pm = providerMeta(n.provider);
            const busy = busyId === n.phone_number_id;
            return (
              <TableRow key={n.phone_number_id}>
                <TableCell className="align-top">
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-[14px] font-medium tabular-nums">{n.phone_number}</span>
                    <CopyButton value={n.phone_number} label="Copy number" size="xs" />
                  </div>
                  {n.label ? <div className="truncate text-xs text-muted-foreground">{n.label}</div> : <div className="text-xs italic text-muted-foreground">No label</div>}
                </TableCell>
                <TableCell className="align-top">
                  <Badge variant={pm.variant}>{pm.label}</Badge>
                </TableCell>
                <TableCell className="align-top">
                  <Capabilities n={n} />
                </TableCell>
                <TableCell className="align-top">
                  <div className="flex items-center gap-2">
                    <AgentSelect compact agents={agents} loading={agentsLoading} value={n.assigned_agent?.agent_id ?? ""} current={n.assigned_agent} onChange={(v) => assign(n, v)} noneLabel="Unassigned" disabled={busy} className="max-w-[220px]" />
                    {busy ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" /> : null}
                  </div>
                  {!n.assigned_agent ? <p className="mt-1 text-[11px] text-muted-foreground">Inbound calls need an agent.</p> : null}
                </TableCell>
                <TableCell className="align-top">
                  <TrunkDetails n={n} />
                </TableCell>
                <TableCell className="text-right align-top">
                  <DropdownMenu>
                    <Tip label="Actions">
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${n.phone_number}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                    </Tip>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onEdit(n)}>
                        <Pencil /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => {
                          navigator.clipboard?.writeText(n.phone_number_id).then(
                            () => toast.success("Phone number ID copied"),
                            () => toast.error("Couldn't copy to clipboard")
                          );
                        }}
                      >
                        <span className="font-mono text-xs">ID</span> Copy phone number ID
                      </DropdownMenuItem>
                      {n.assigned_agent ? (
                        <DropdownMenuItem onSelect={() => assign(n, "")} disabled={busy}>
                          <UserRoundMinus /> Unassign agent
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem destructive onSelect={() => onRemove(n)}>
                        <Trash2 /> Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
