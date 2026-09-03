"use client";
import { useEffect, useId, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Network } from "lucide-react";
import type { Agent } from "@/lib/types";
import { useImportSipNumber } from "@/hooks/api";
import { SwitchRow } from "@/components/agents/form/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AgentSelect } from "./AgentSelect";
import { InfoBox } from "./InfoBox";
import { PhoneNumberField } from "./PhoneNumberField";
import { InboundTrunkFields, OutboundTrunkFields, TrunkSection, emptyInbound, emptyOutbound, hasErrors, inboundPayload, outboundPayload, validateInbound, validateOutbound, type InboundForm, type OutboundForm, type TrunkErrors } from "./SipTrunkFields";
import { parseDialNumber } from "./phone-utils";

interface Errors {
  phone?: string;
  label?: string;
  caps?: string;
  outbound: TrunkErrors;
  inbound: TrunkErrors;
}

export function SipHowItWorks() {
  return (
    <InfoBox icon={Network} title="How SIP trunking works with ElevenLabs">
      <ul className="list-disc space-y-1 pl-4">
        <li>
          <span className="font-medium text-foreground">Inbound</span> — point your carrier or PBX at ElevenLabs' SIP endpoint <code className="rounded bg-muted px-1 font-mono text-[11.5px] text-foreground">sip.rtc.elevenlabs.io</code> (TLS 5061, or UDP/TCP 5060) and send the E.164 number in the To header.
        </li>
        <li>
          <span className="font-medium text-foreground">Outbound</span> — ElevenLabs sends INVITEs to your provider's termination URI (the address below), authenticating with the trunk credentials if your provider requires them.
        </li>
        <li>Numbers must be in E.164 format: a plus sign, country code and digits only.</li>
      </ul>
    </InfoBox>
  );
}

export function ConnectSipDialog({ open, onOpenChange, agents, agentsLoading }: { open: boolean; onOpenChange: (o: boolean) => void; agents?: Agent[]; agentsLoading?: boolean }) {
  const id = useId();
  const mut = useImportSipNumber();
  const [phone, setPhone] = useState("");
  const [label, setLabel] = useState("");
  const [agentId, setAgentId] = useState("");
  const [supportsInbound, setSupportsInbound] = useState(true);
  const [supportsOutbound, setSupportsOutbound] = useState(true);
  const [outbound, setOutbound] = useState<OutboundForm>(emptyOutbound);
  const [inbound, setInbound] = useState<InboundForm>(emptyInbound);
  const [inboundOpen, setInboundOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPhone("");
    setLabel("");
    setAgentId("");
    setSupportsInbound(true);
    setSupportsOutbound(true);
    setOutbound(emptyOutbound());
    setInbound(emptyInbound());
    setInboundOpen(false);
    setSubmitted(false);
  }, [open]);

  const parsed = parseDialNumber(phone);
  const errors = useMemo<Errors>(() => {
    const e: Errors = { outbound: {}, inbound: {} };
    if (!parsed.ok) e.phone = parsed.reason;
    if (!label.trim()) e.label = "Give the number a label so you can tell it apart.";
    else if (label.trim().length > 80) e.label = "Keep the label under 80 characters.";
    if (!supportsInbound && !supportsOutbound) e.caps = "Enable inbound, outbound, or both.";
    e.outbound = validateOutbound(outbound, { requireAddress: supportsOutbound, secretsRequired: false });
    if (inboundOpen) e.inbound = validateInbound(inbound, { secretsRequired: false });
    return e;
  }, [parsed, label, supportsInbound, supportsOutbound, outbound, inbound, inboundOpen]);
  const invalid = Boolean(errors.phone || errors.label || errors.caps) || hasErrors(errors.outbound) || hasErrors(errors.inbound);

  const submit = () => {
    setSubmitted(true);
    if (invalid || !parsed.ok) return;
    mut.mutate(
      {
        phone_number: parsed.value,
        label: label.trim(),
        agent_id: agentId || undefined,
        supports_inbound: supportsInbound,
        supports_outbound: supportsOutbound,
        outbound: outbound.address.trim() ? outboundPayload(outbound) : undefined,
        inbound: inboundOpen ? inboundPayload(inbound) : undefined,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!mut.isPending ? onOpenChange(o) : undefined)}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Connect SIP trunk</DialogTitle>
          <DialogDescription>Bring your own carrier or PBX. ElevenLabs registers the number and routes calls over SIP.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5">
          <SipHowItWorks />

          <div className="grid gap-4 sm:grid-cols-2">
            <PhoneNumberField id={`${id}-phone`} value={phone} onChange={setPhone} error={submitted ? errors.phone : undefined} autoFocus />
            <Field label="Label" htmlFor={`${id}-label`} error={submitted ? errors.label : undefined}>
              <Input id={`${id}-label`} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Main office trunk" maxLength={80} />
            </Field>
          </div>

          <Field label="Assign to agent" hint="optional" htmlFor={`${id}-agent`} help="Inbound calls to this number are answered by the assigned agent. You can change this later.">
            <AgentSelect id={`${id}-agent`} agents={agents} loading={agentsLoading} value={agentId} onChange={setAgentId} />
          </Field>

          <div className="space-y-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <SwitchRow label="Inbound calls" help="Accept calls to this number" checked={supportsInbound} onCheckedChange={setSupportsInbound} />
              <SwitchRow label="Outbound calls" help="Let agents dial out from it" checked={supportsOutbound} onCheckedChange={setSupportsOutbound} />
            </div>
            {submitted && errors.caps ? <p className="text-xs text-destructive">{errors.caps}</p> : null}
          </div>

          <TrunkSection icon={ArrowUpFromLine} title="Outbound trunk" description="Where ElevenLabs sends the calls your agents place.">
            <OutboundTrunkFields value={outbound} onChange={setOutbound} errors={submitted ? errors.outbound : undefined} requireAddress={supportsOutbound} />
          </TrunkSection>

          <TrunkSection icon={ArrowDownToLine} title="Inbound trunk" description="Restrict which addresses and numbers may reach this number, and require auth." badge="Optional" open={inboundOpen} onToggle={() => setInboundOpen((o) => !o)}>
            <InboundTrunkFields value={inbound} onChange={setInbound} errors={submitted ? errors.inbound : undefined} />
          </TrunkSection>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={mut.isPending}>
            Connect number
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
