"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { AudioLines, Plug } from "lucide-react";
import type { ApiError } from "@/lib/api";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

/** Error code every ElevenLabs-backed endpoint returns (HTTP 409) when the workspace has no API key. */
export const ELEVENLABS_NOT_CONFIGURED = "ELEVENLABS_NOT_CONFIGURED";

export function isElevenNotConfigured(err: unknown): boolean {
  return (err as ApiError | null | undefined)?.code === ELEVENLABS_NOT_CONFIGURED;
}

const DEFAULT_DESCRIPTION = "This workspace has no ElevenLabs API key yet. Voice agents, phone numbers, voices and calls all run through your own ElevenLabs account.";

/** Full-page empty state for list pages whose main query failed with ELEVENLABS_NOT_CONFIGURED. */
export function ElevenLabsRequired({ title = "Connect ElevenLabs to continue", description = DEFAULT_DESCRIPTION, className }: { title?: string; description?: string; className?: string }) {
  return (
    <EmptyState
      icon={AudioLines}
      title={title}
      description={description}
      className={className}
      action={
        <Link href="/integrations" className={buttonVariants()}>
          <Plug /> Connect ElevenLabs
        </Link>
      }
    />
  );
}

/** Compact inline notice for dialogs and form sections. Renders "Connect ElevenLabs {children}". */
export function ElevenLabsRequiredNotice({ children = "in Integrations to load your agents, numbers and voices.", className }: { children?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start gap-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground", className)}>
      <Plug className="mt-0.5 size-4 shrink-0 text-primary" />
      <span>
        <Link href="/integrations" className="font-medium text-primary hover:underline">
          Connect ElevenLabs
        </Link>{" "}
        {children}
      </span>
    </div>
  );
}
