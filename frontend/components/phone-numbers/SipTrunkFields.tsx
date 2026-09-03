"use client";
import { useId, type ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import type { PhoneNumber, SipImportInput } from "@/lib/types";
import { KeyValueEditor, TagInput } from "@/components/agents/form/primitives";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SecretInput } from "./SecretInput";
import { ENCRYPTION_OPTIONS, TRANSPORT_OPTIONS, isValidSipAddress, type Encryption, type Transport } from "./phone-utils";

/* ---------- form models ---------- */

export interface OutboundForm {
  address: string;
  transport: Transport;
  media_encryption: Encryption;
  username: string;
  password: string;
  headers: Record<string, string>;
}
export interface InboundForm {
  allowed_addresses: string[];
  allowed_numbers: string[];
  media_encryption: Encryption;
  username: string;
  password: string;
}
export interface TrunkErrors {
  address?: string;
  addresses?: string;
  credentials?: string;
}

export const emptyOutbound = (): OutboundForm => ({ address: "", transport: "auto", media_encryption: "allowed", username: "", password: "", headers: {} });
export const emptyInbound = (): InboundForm => ({ allowed_addresses: ["0.0.0.0/0"], allowed_numbers: [], media_encryption: "allowed", username: "", password: "" });

export function outboundFromNumber(n: PhoneNumber): OutboundForm {
  const c = n.outbound_trunk ?? n.provider_config ?? {};
  return { address: c.address ?? "", transport: c.transport ?? "auto", media_encryption: c.media_encryption ?? "allowed", username: c.username ?? "", password: "", headers: { ...(c.headers ?? {}) } };
}
export function inboundFromNumber(n: PhoneNumber): InboundForm {
  const c = n.inbound_trunk ?? {};
  return { allowed_addresses: [...(c.allowed_addresses ?? [])], allowed_numbers: [...(c.allowed_numbers ?? [])], media_encryption: c.media_encryption ?? "allowed", username: c.username ?? "", password: "" };
}

/* ---------- validation & payloads ---------- */

const SECRET_MSG = "Re-enter the password — ElevenLabs never returns stored secrets, so saving trunk changes needs it again.";

export function validateOutbound(f: OutboundForm, opts: { requireAddress: boolean; secretsRequired: boolean }): TrunkErrors {
  const e: TrunkErrors = {};
  const addr = f.address.trim();
  if (!addr && opts.requireAddress) e.address = "Enter your provider's termination address to place outbound calls.";
  else if (addr && !isValidSipAddress(addr)) e.address = "Use host or host:port — no scheme, path or spaces.";
  const user = f.username.trim();
  if (f.password && !user) e.credentials = "Add a username to go with the password.";
  else if (user && !f.password && opts.secretsRequired) e.credentials = SECRET_MSG;
  return e;
}
export function validateInbound(f: InboundForm, opts: { secretsRequired: boolean }): TrunkErrors {
  const e: TrunkErrors = {};
  if (!f.allowed_addresses.length) e.addresses = "Add at least one address — use 0.0.0.0/0 to accept calls from anywhere.";
  const user = f.username.trim();
  if (f.password && !user) e.credentials = "Add a username to go with the password.";
  else if (user && !f.password && opts.secretsRequired) e.credentials = SECRET_MSG;
  return e;
}
export const hasErrors = (e: TrunkErrors): boolean => Boolean(e.address || e.addresses || e.credentials);

export function outboundPayload(f: OutboundForm): NonNullable<SipImportInput["outbound"]> {
  const username = f.username.trim();
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(f.headers)) if (k.trim()) headers[k.trim()] = v;
  return {
    address: f.address.trim(),
    transport: f.transport,
    media_encryption: f.media_encryption,
    credentials: username ? { username, password: f.password || undefined } : undefined,
    headers: Object.keys(headers).length ? headers : undefined,
  };
}
export function inboundPayload(f: InboundForm): NonNullable<SipImportInput["inbound"]> {
  const username = f.username.trim();
  return {
    allowed_addresses: f.allowed_addresses,
    allowed_numbers: f.allowed_numbers.length ? f.allowed_numbers : undefined,
    media_encryption: f.media_encryption,
    credentials: username ? { username, password: f.password || undefined } : undefined,
  };
}

/* ---------- section chrome ---------- */

export function TrunkSection({ icon: Icon, title, description, badge, open = true, onToggle, children, className }: { icon: LucideIcon; title: string; description?: string; badge?: string; open?: boolean; onToggle?: () => void; children: ReactNode; className?: string }) {
  const collapsible = typeof onToggle === "function";
  const header = (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-tint text-primary-hover">
        <Icon className="size-4" strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <h3 className="font-heading text-[16px] leading-tight">{title}</h3>
          {badge ? <Badge variant="outline">{badge}</Badge> : null}
        </div>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {collapsible ? <ChevronDown className={cn("mt-1.5 size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} /> : null}
    </div>
  );
  return (
    <section className={cn("rounded-lg border border-border", className)}>
      {collapsible ? (
        <button type="button" onClick={onToggle} aria-expanded={open} className="w-full rounded-lg px-4 py-3 transition-colors hover:bg-muted/40">
          {header}
        </button>
      ) : (
        <div className="px-4 py-3">{header}</div>
      )}
      {open ? <div className="border-t border-border px-4 py-4">{children}</div> : null}
    </section>
  );
}

/* ---------- field groups ---------- */

function EncryptionSelect({ id, value, onChange }: { id: string; value: Encryption; onChange: (v: Encryption) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Encryption)}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ENCRYPTION_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value} description={o.description}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CredentialFields({ idPrefix, username, password, onUsername, onPassword, storedAuth, error }: { idPrefix: string; username: string; password: string; onUsername: (v: string) => void; onPassword: (v: string) => void; storedAuth?: boolean; error?: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Username" hint="optional" htmlFor={`${idPrefix}-user`}>
        <Input id={`${idPrefix}-user`} value={username} onChange={(e) => onUsername(e.target.value)} autoComplete="off" spellCheck={false} placeholder="trunk-user" className="font-mono text-[13px]" />
      </Field>
      <Field label="Password" hint="optional" htmlFor={`${idPrefix}-pass`} help={storedAuth && !password ? "A password is stored in ElevenLabs; it can't be shown here." : undefined} error={error}>
        <SecretInput id={`${idPrefix}-pass`} value={password} onChange={(e) => onPassword(e.target.value)} placeholder={storedAuth ? "••••••••" : ""} />
      </Field>
    </div>
  );
}

export function OutboundTrunkFields({ value, onChange, errors, requireAddress, storedAuth }: { value: OutboundForm; onChange: (v: OutboundForm) => void; errors?: TrunkErrors; requireAddress?: boolean; storedAuth?: boolean }) {
  const id = useId();
  const set = <K extends keyof OutboundForm>(k: K, v: OutboundForm[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-4">
      <Field label="Termination address" hint={requireAddress ? "required for outbound" : "optional"} htmlFor={`${id}-addr`} error={errors?.address} help={errors?.address ? undefined : "Your provider's SIP termination URI as host or host:port. ElevenLabs sends outbound INVITEs here."}>
        <Input id={`${id}-addr`} value={value.address} onChange={(e) => set("address", e.target.value)} placeholder="sip.provider.com:5060" autoComplete="off" spellCheck={false} className="font-mono text-[13px]" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Transport" htmlFor={`${id}-transport`}>
          <Select value={value.transport} onValueChange={(v) => set("transport", v as Transport)}>
            <SelectTrigger id={`${id}-transport`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRANSPORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} description={o.description}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Media encryption" htmlFor={`${id}-enc`}>
          <EncryptionSelect id={`${id}-enc`} value={value.media_encryption} onChange={(v) => set("media_encryption", v)} />
        </Field>
      </div>
      <CredentialFields idPrefix={`${id}-out`} username={value.username} password={value.password} onUsername={(v) => set("username", v)} onPassword={(v) => set("password", v)} storedAuth={storedAuth} error={errors?.credentials} />
      <div>
        <Label hint="optional">Custom SIP headers</Label>
        <p className="mb-2 mt-1 text-xs text-muted-foreground">Added to every outbound INVITE — handy for provider-side routing or account tags.</p>
        <KeyValueEditor value={value.headers} onChange={(h) => set("headers", h)} keyPlaceholder="X-Account-Id" valuePlaceholder="value" addLabel="Add header" emptyText="No custom headers." />
      </div>
    </div>
  );
}

export function InboundTrunkFields({ value, onChange, errors, storedAuth }: { value: InboundForm; onChange: (v: InboundForm) => void; errors?: TrunkErrors; storedAuth?: boolean }) {
  const id = useId();
  const set = <K extends keyof InboundForm>(k: K, v: InboundForm[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-4">
      <Field label="Allowed source addresses" htmlFor={`${id}-addrs`} error={errors?.addresses} help={errors?.addresses ? undefined : "IPs or CIDR ranges your provider sends calls from. 0.0.0.0/0 accepts calls from anywhere — narrow it once you know your provider's signalling IPs."}>
        <TagInput value={value.allowed_addresses} onChange={(v) => set("allowed_addresses", v)} placeholder="203.0.113.0/24, press Enter" mono ariaLabel="Allowed source addresses" />
      </Field>
      <Field label="Allowed numbers" hint="optional" htmlFor={`${id}-nums`} help="Only accept calls addressed to these E.164 numbers. Leave empty to accept any.">
        <TagInput value={value.allowed_numbers} onChange={(v) => set("allowed_numbers", v)} placeholder="+14155550100, press Enter" mono ariaLabel="Allowed numbers" />
      </Field>
      <Field label="Media encryption" htmlFor={`${id}-enc`} className="sm:max-w-[50%]">
        <EncryptionSelect id={`${id}-enc`} value={value.media_encryption} onChange={(v) => set("media_encryption", v)} />
      </Field>
      <CredentialFields idPrefix={`${id}-in`} username={value.username} password={value.password} onUsername={(v) => set("username", v)} onPassword={(v) => set("password", v)} storedAuth={storedAuth} error={errors?.credentials} />
    </div>
  );
}
