"use client";
import { useEffect, useId, useMemo, useState } from "react";
import { ExternalLink, KeyRound } from "lucide-react";
import type { Agent } from "@/lib/types";
import { useImportTwilioNumber } from "@/hooks/api";
import { SwitchRow } from "@/components/agents/form/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AgentSelect } from "./AgentSelect";
import { InfoBox } from "./InfoBox";
import { PhoneNumberField } from "./PhoneNumberField";
import { SecretInput } from "./SecretInput";
import { parseDialNumber } from "./phone-utils";

interface Errors {
  phone?: string;
  label?: string;
  sid?: string;
  token?: string;
  caps?: string;
}

export function ImportTwilioDialog({ open, onOpenChange, agents, agentsLoading }: { open: boolean; onOpenChange: (o: boolean) => void; agents?: Agent[]; agentsLoading?: boolean }) {
  const id = useId();
  const mut = useImportTwilioNumber();
  const [phone, setPhone] = useState("");
  const [label, setLabel] = useState("");
  const [sid, setSid] = useState("");
  const [token, setToken] = useState("");
  const [agentId, setAgentId] = useState("");
  const [inbound, setInbound] = useState(true);
  const [outbound, setOutbound] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPhone("");
    setLabel("");
    setSid("");
    setToken("");
    setAgentId("");
    setInbound(true);
    setOutbound(true);
    setSubmitted(false);
  }, [open]);

  const parsed = parseDialNumber(phone);
  const errors = useMemo<Errors>(() => {
    const e: Errors = {};
    if (!parsed.ok) e.phone = parsed.reason;
    if (!label.trim()) e.label = "Give the number a label so you can tell it apart.";
    else if (label.trim().length > 80) e.label = "Keep the label under 80 characters.";
    const s = sid.trim();
    if (s.length < 10) e.sid = "Paste the full Account SID (starts with AC, 34 characters).";
    else if (!/^AC[0-9a-f]{32}$/i.test(s)) e.sid = "Twilio Account SIDs start with AC followed by 32 hex characters.";
    if (token.trim().length < 10) e.token = "Paste the full Auth Token from the Twilio console.";
    if (!inbound && !outbound) e.caps = "Enable inbound, outbound, or both.";
    return e;
  }, [parsed, label, sid, token, inbound, outbound]);
  const invalid = Object.keys(errors).length > 0;
  const show = (k: keyof Errors) => (submitted ? errors[k] : undefined);

  const submit = () => {
    setSubmitted(true);
    if (invalid || !parsed.ok) return;
    mut.mutate(
      { phone_number: parsed.value, label: label.trim(), sid: sid.trim(), token: token.trim(), agent_id: agentId || undefined, supports_inbound: inbound, supports_outbound: outbound },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!mut.isPending ? onOpenChange(o) : undefined)}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Import Twilio number</DialogTitle>
          <DialogDescription>ElevenLabs takes over the number's voice webhook so your agents can answer and place calls on it.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5">
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <PhoneNumberField id={`${id}-phone`} value={phone} onChange={setPhone} error={show("phone")} autoFocus />
              <Field label="Label" htmlFor={`${id}-label`} error={show("label")}>
                <Input id={`${id}-label`} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Sales line (US)" maxLength={80} />
              </Field>
            </div>

            <div className="space-y-4 rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <KeyRound className="size-4 text-primary" /> Twilio credentials
              </div>
              <Field label="Account SID" htmlFor={`${id}-sid`} error={show("sid")}>
                <Input id={`${id}-sid`} value={sid} onChange={(e) => setSid(e.target.value)} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" autoComplete="off" spellCheck={false} className="font-mono text-[13px]" />
              </Field>
              <Field label="Auth token" htmlFor={`${id}-token`} error={show("token")} help="Stored by ElevenLabs only; Matrix never keeps it.">
                <SecretInput id={`${id}-token`} value={token} onChange={(e) => setToken(e.target.value)} placeholder="Your Twilio auth token" />
              </Field>
              <p className="text-xs leading-5 text-muted-foreground">
                Both are under <span className="font-medium text-foreground">Account Info</span> on the{" "}
                <a href="https://console.twilio.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">
                  Twilio Console home page <ExternalLink className="size-3" />
                </a>
                . The number must already be purchased in that account — ElevenLabs can't buy numbers for you.
              </p>
            </div>

            <Field label="Assign to agent" hint="optional" htmlFor={`${id}-agent`} help="Inbound calls to this number are answered by the assigned agent. You can change this later.">
              <AgentSelect id={`${id}-agent`} agents={agents} loading={agentsLoading} value={agentId} onChange={setAgentId} />
            </Field>

            <div className="space-y-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <SwitchRow label="Inbound calls" help="Agents answer calls to this number" checked={inbound} onCheckedChange={setInbound} />
                <SwitchRow label="Outbound calls" help="Agents can dial out from it" checked={outbound} onCheckedChange={setOutbound} />
              </div>
              {show("caps") ? <p className="text-xs text-destructive">{errors.caps}</p> : null}
            </div>
            <button type="submit" className="hidden" aria-hidden />
          </form>

          <InfoBox>Numbers are stored in your ElevenLabs workspace. Removing the number here only detaches it from ElevenLabs — it stays in Twilio.</InfoBox>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={mut.isPending}>
            Import number
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
