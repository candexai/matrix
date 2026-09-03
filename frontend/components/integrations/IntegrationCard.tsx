"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Server } from "lucide-react";
import type { IntegrationItem } from "@/lib/types";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BrandIcon } from "./BrandIcons";
import { INTEGRATION_DESCRIPTIONS } from "./integrationCopy";

export type CardStatus = "connected" | "disconnected" | "setup" | "soon" | "error";

const STATUS_META: Record<CardStatus, { label: string; variant: NonNullable<BadgeProps["variant"]> }> = {
  connected: { label: "Connected", variant: "success" },
  disconnected: { label: "Not connected", variant: "outline" },
  setup: { label: "Needs setup", variant: "warning" },
  soon: { label: "Coming soon", variant: "secondary" },
  error: { label: "Error", variant: "destructive" },
};

export function StatusBadge({ status }: { status: CardStatus }) {
  const m = STATUS_META[status];
  return (
    <Badge variant={m.variant}>
      {status === "connected" ? <Check /> : null}
      {m.label}
    </Badge>
  );
}

/** Shared chrome for every integration card. */
export function IntegrationCardShell({ id, name, description, status, children, footer, className }: { id: string; name: string; description?: string; status: CardStatus; children?: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col rounded-xl border border-border bg-card shadow-xs", status === "soon" && "opacity-80", className)}>
      <div className="flex items-start gap-3 p-5 pb-4">
        <BrandIcon id={id} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-heading text-[17px] leading-tight">{name}</h3>
            <StatusBadge status={status} />
          </div>
          <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{description ?? INTEGRATION_DESCRIPTIONS[id] ?? ""}</p>
        </div>
      </div>
      {children ? <div className="flex-1 px-5 pb-4">{children}</div> : <div className="flex-1" />}
      {footer ? <div className="flex items-center gap-2 border-t border-border px-5 py-3">{footer}</div> : null}
    </div>
  );
}

export function ComingSoonCard({ item }: { item: IntegrationItem }) {
  return (
    <IntegrationCardShell
      id={item.id}
      name={item.name}
      status="soon"
      footer={
        <>
          <Button variant="outline" size="sm" disabled>
            Coming soon
          </Button>
          {item.note ? <span className="text-xs text-muted-foreground">{item.note}</span> : null}
        </>
      }
    />
  );
}

export function ElevenLabsCard({ item }: { item: IntegrationItem }) {
  const connected = Boolean(item.connected);
  return (
    <IntegrationCardShell
      id={item.id}
      name={item.name}
      status={connected ? "connected" : "setup"}
      footer={
        <>
          <Link href="/agents" className={buttonVariants({ variant: connected ? "default" : "outline", size: "sm" })}>
            Manage agents <ArrowUpRight />
          </Link>
          {!connected ? <span className="text-xs text-muted-foreground">Add ELEVENLABS_API_KEY to backend/.env</span> : null}
        </>
      }
    >
      <dl className="space-y-1.5 text-[13px]">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">API</dt>
          <dd className="truncate font-mono text-[12px]" title={item.baseUrl}>
            {item.baseUrl ?? "—"}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="inline-flex items-center gap-1 text-muted-foreground">
            <Server className="size-3.5" /> Python service
          </dt>
          <dd className="truncate font-mono text-[12px]" title={item.pythonService ?? undefined}>
            {item.pythonService ? item.pythonService : <span className="font-sans text-muted-foreground">not configured</span>}
          </dd>
        </div>
      </dl>
    </IntegrationCardShell>
  );
}
