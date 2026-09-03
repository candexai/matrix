"use client";
import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useClearZohoApp, useSaveZohoApp, useZohoApp, useZohoStatus } from "@/hooks/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DATA_CENTERS = [
  { value: "https://accounts.zoho.in", label: "India · accounts.zoho.in", console: "https://api-console.zoho.in" },
  { value: "https://accounts.zoho.com", label: "US · accounts.zoho.com", console: "https://api-console.zoho.com" },
  { value: "https://accounts.zoho.eu", label: "EU · accounts.zoho.eu", console: "https://api-console.zoho.eu" },
  { value: "https://accounts.zoho.com.au", label: "Australia · accounts.zoho.com.au", console: "https://api-console.zoho.com.au" },
  { value: "https://accounts.zoho.jp", label: "Japan · accounts.zoho.jp", console: "https://api-console.zoho.jp" },
  { value: "https://accounts.zoho.sa", label: "Saudi Arabia · accounts.zoho.sa", console: "https://api-console.zoho.sa" },
  { value: "https://accounts.zohocloud.ca", label: "Canada · accounts.zohocloud.ca", console: "https://api-console.zohocloud.ca" },
];

function CopyBox({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-2.5 py-1.5 font-mono text-[12px]">
      <span className="min-w-0 flex-1 truncate">{value}</span>
      <button
        type="button"
        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          } catch {
            toast.error("Couldn't copy");
          }
        }}
        aria-label="Copy"
      >
        {done ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}

/**
 * Configure the Zoho OAuth client (Client ID / Secret from the Zoho API console) for this
 * workspace. Lets production connect with its own callback URL — no server env edits needed.
 */
export function ZohoAppDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const app = useZohoApp();
  const status = useZohoStatus();
  const save = useSaveZohoApp();
  const clear = useClearZohoApp();

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [accountsUrl, setAccountsUrl] = useState("https://accounts.zoho.in");

  useEffect(() => {
    if (!open) return;
    setClientId(app.data?.source === "db" ? app.data.clientId : "");
    setClientSecret("");
    setAccountsUrl(app.data?.accountsUrl || status.data?.accountsUrl || "https://accounts.zoho.in");
  }, [open, app.data, status.data?.accountsUrl]);

  const redirectUri = status.data?.defaultRedirectUri || status.data?.redirectUri || `${typeof window !== "undefined" ? window.location.origin : ""}/api/v1/integrations/zoho/callback`;
  const dc = DATA_CENTERS.find((d) => d.value === accountsUrl) ?? DATA_CENTERS[0];
  const usingEnv = app.data?.source === "env";
  const canSave = clientId.trim().length > 10 && (clientSecret.trim().length > 10 || (app.data?.source === "db" && clientId.trim() === app.data.clientId));

  const onSave = async () => {
    await save.mutateAsync({ clientId: clientId.trim(), clientSecret: clientSecret.trim() || undefined, accountsUrl });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Zoho app settings</DialogTitle>
          <DialogDescription>Use your own Zoho OAuth client so this site can complete the Zoho login with its own callback URL.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5">
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-[13px] leading-6">
            <div className="mb-1 font-medium">Create the client once (about 2 minutes)</div>
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>
                Open the Zoho API console for your data centre:{" "}
                <a href={dc.console} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  {dc.console.replace("https://", "")} <ExternalLink className="size-3" />
                </a>{" "}
                and sign in with your Zoho account (any CRM user can create a client).
              </li>
              <li>
                <strong>Add Client → Server-based Applications</strong>. Client name: anything (e.g. Matrix). Homepage URL: this site.
              </li>
              <li>
                <strong>Authorized Redirect URIs</strong> — paste exactly:
                <div className="mt-1">
                  <CopyBox value={redirectUri} />
                </div>
              </li>
              <li>Click Create, then copy the <strong>Client ID</strong> and <strong>Client Secret</strong> into the fields below.</li>
            </ol>
          </div>

          {usingEnv ? (
            <p className="text-[13px] text-muted-foreground">
              Currently using the client from the server configuration (<span className="font-mono">{app.data?.clientId.slice(0, 9)}…</span>). Saving here overrides it.
            </p>
          ) : app.data?.source === "db" ? (
            <p className="text-[13px] text-muted-foreground">
              Client <span className="font-mono">{app.data.clientId.slice(0, 9)}…</span> is configured here. Leave the secret empty to keep the existing one.
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client ID" htmlFor="zoho-client-id" className="sm:col-span-2">
              <Input id="zoho-client-id" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="1000.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" className="font-mono" autoComplete="off" />
            </Field>
            <Field label="Client Secret" htmlFor="zoho-client-secret" help={app.data?.source === "db" ? "Leave empty to keep the saved secret." : undefined} className="sm:col-span-2">
              <Input id="zoho-client-secret" type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="••••••••••••••••••••••••••••••••" className="font-mono" autoComplete="new-password" />
            </Field>
            <Field label="Data centre" htmlFor="zoho-dc" help="Where your Zoho account lives. Wrong region → “Invalid Client”." className="sm:col-span-2">
              <Select value={accountsUrl} onValueChange={setAccountsUrl}>
                <SelectTrigger id="zoho-dc">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATA_CENTERS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </DialogBody>
        <DialogFooter className="justify-between">
          <div>
            {app.data?.source === "db" ? (
              <Button variant="ghost" size="sm" onClick={() => clear.mutate(undefined, { onSuccess: () => onOpenChange(false) })} loading={clear.isPending} className="text-muted-foreground">
                Remove & use server settings
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={!canSave} loading={save.isPending}>
              {save.isPending ? <Loader2 className="animate-spin" /> : <KeyRound />} Save client
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
