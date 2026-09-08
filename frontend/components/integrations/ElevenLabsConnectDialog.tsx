"use client";
import { useEffect, useState } from "react";
import { ExternalLink, KeyRound, TriangleAlert } from "lucide-react";
import { useConnectEleven, useElevenStatus } from "@/hooks/api";
import type { ApiError } from "@/lib/api";
import { SecretInput } from "@/components/phone-numbers/SecretInput";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type ConnectDialogMode = "connect" | "replace";
type Region = "us" | "eu";

const API_KEYS_URL = "https://elevenlabs.io/app/settings/api-keys";
const REGIONS: { value: Region; label: string; description: string }[] = [
  { value: "us", label: "US · api.elevenlabs.io", description: "Default for most accounts" },
  { value: "eu", label: "EU · data residency", description: "Accounts created with EU data residency" },
];

/**
 * Connect (or replace) the ElevenLabs API key for this workspace. The key goes over PUT once and is stored
 * encrypted by the backend; only a short hint ever comes back. Errors are shown inline (no toast).
 */
export function ElevenLabsConnectDialog({ open, onOpenChange, mode = "connect" }: { open: boolean; onOpenChange: (o: boolean) => void; mode?: ConnectDialogMode }) {
  const status = useElevenStatus();
  const connect = useConnectEleven();
  const [apiKey, setApiKey] = useState("");
  const [region, setRegion] = useState<Region>("us");
  const [error, setError] = useState<ApiError | null>(null);

  const current = status.data;
  useEffect(() => {
    if (!open) return;
    setApiKey("");
    setRegion(current?.region ?? "us");
    setError(null);
  }, [open, current?.region]);

  const usingEnv = Boolean(current?.configured && current.source === "env");
  const title = mode === "replace" ? "Replace ElevenLabs key" : usingEnv ? "Add your own ElevenLabs key" : "Connect ElevenLabs";
  const invalidKey = error?.code === "ELEVENLABS_INVALID_KEY";
  const canSave = apiKey.trim().length > 10 && !connect.isPending;

  const onSave = async () => {
    if (!canSave) return;
    setError(null);
    try {
      await connect.mutateAsync({ apiKey: apiKey.trim(), region });
      onOpenChange(false);
    } catch (e) {
      setError(e as ApiError);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!connect.isPending ? onOpenChange(o) : undefined)}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Matrix runs agents, voices, phone numbers and calls through your own ElevenLabs account. The key is stored encrypted and used only for this workspace.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5">
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-[13px] leading-6">
            <div className="mb-1 font-medium">Get a key (about a minute)</div>
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>
                Open{" "}
                <a href={API_KEYS_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  elevenlabs.io/app/settings/api-keys <ExternalLink className="size-3" />
                </a>{" "}
                and click <strong>Create API key</strong>.
              </li>
              <li>Leave the default (full) permissions — Matrix needs agents, voices, phone numbers and usage.</li>
              <li>Copy the key straight away (ElevenLabs shows it only once) and paste it below.</li>
            </ol>
          </div>

          {usingEnv ? <p className="text-[13px] text-muted-foreground">This workspace currently uses the key configured on the server. Saving a key here overrides it for this workspace only.</p> : null}
          {mode === "replace" && !usingEnv ? (
            <p className="text-[13px] text-muted-foreground">Agents and numbers stay as they are if the new key belongs to the same ElevenLabs account. A key from a different account shows that account’s agents instead.</p>
          ) : null}

          <Field label="API key" htmlFor="eleven-api-key" error={invalidKey ? error?.message || "ElevenLabs rejected this key." : undefined} help={invalidKey ? undefined : "Paste the whole key — recent ones start with sk_."}>
            <SecretInput
              id="eleven-api-key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk_••••••••••••••••••••••••••••••••"
              autoFocus
              aria-invalid={invalidKey || undefined}
              onKeyDown={(e) => {
                if (e.key === "Enter") void onSave();
              }}
            />
          </Field>
          <Field label="Region" htmlFor="eleven-region" help="Where your ElevenLabs account lives. Pick EU only if you signed up with EU data residency.">
            <Select value={region} onValueChange={(v) => setRegion(v as Region)}>
              <SelectTrigger id="eleven-region">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value} description={r.description}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {error && !invalidKey ? (
            <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px]">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
              <span>{error.message || "Could not save the key."}</span>
            </div>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={connect.isPending}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!canSave} loading={connect.isPending}>
            {connect.isPending ? null : <KeyRound />} {mode === "replace" ? "Replace key" : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
