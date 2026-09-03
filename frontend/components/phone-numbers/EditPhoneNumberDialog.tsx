"use client";
import { useEffect, useId, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import type { PhoneNumber } from "@/lib/types";
import { useUpdatePhoneNumber } from "@/hooks/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InfoBox } from "./InfoBox";
import { InboundTrunkFields, OutboundTrunkFields, TrunkSection, emptyInbound, emptyOutbound, hasErrors, inboundFromNumber, inboundPayload, outboundFromNumber, outboundPayload, validateInbound, validateOutbound, type InboundForm, type OutboundForm, type TrunkErrors } from "./SipTrunkFields";
import { isSipNumber, providerMeta } from "./phone-utils";

export function EditPhoneNumberDialog({ number, open, onOpenChange }: { number: PhoneNumber | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const id = useId();
  const update = useUpdatePhoneNumber();
  const sip = number ? isSipNumber(number) : false;

  const [label, setLabel] = useState("");
  const [outbound, setOutbound] = useState<OutboundForm>(emptyOutbound);
  const [inbound, setInbound] = useState<InboundForm>(emptyInbound);
  const [inboundOpen, setInboundOpen] = useState(false);
  const [initial, setInitial] = useState({ label: "", outbound: "", inbound: "" });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open || !number) return;
    const o = outboundFromNumber(number);
    const i = inboundFromNumber(number);
    setLabel(number.label ?? "");
    setOutbound(o);
    setInbound(i);
    setInboundOpen(Boolean(number.inbound_trunk?.allowed_numbers?.length || number.inbound_trunk?.has_auth_credentials));
    setInitial({ label: number.label ?? "", outbound: JSON.stringify(o), inbound: JSON.stringify(i) });
    setSubmitted(false);
  }, [open, number]);

  const labelDirty = label.trim() !== initial.label;
  const outboundDirty = sip && JSON.stringify(outbound) !== initial.outbound;
  const inboundDirty = sip && JSON.stringify(inbound) !== initial.inbound;
  const dirty = labelDirty || outboundDirty || inboundDirty;

  const errors = useMemo(() => {
    const e: { label?: string; outbound: TrunkErrors; inbound: TrunkErrors } = { outbound: {}, inbound: {} };
    if (!label.trim()) e.label = "The label can't be empty.";
    else if (label.trim().length > 80) e.label = "Keep the label under 80 characters.";
    if (outboundDirty) e.outbound = validateOutbound(outbound, { requireAddress: number?.supports_outbound !== false, secretsRequired: true });
    if (inboundDirty) e.inbound = validateInbound(inbound, { secretsRequired: true });
    return e;
  }, [label, outbound, inbound, outboundDirty, inboundDirty, number?.supports_outbound]);
  const invalid = Boolean(errors.label) || hasErrors(errors.outbound) || hasErrors(errors.inbound);

  const submit = () => {
    if (!number) return;
    setSubmitted(true);
    if (invalid || !dirty) return;
    update.mutate(
      {
        id: number.phone_number_id,
        ...(labelDirty ? { label: label.trim() } : {}),
        ...(outboundDirty ? { outbound: outboundPayload(outbound) } : {}),
        ...(inboundDirty ? { inbound: inboundPayload(inbound) } : {}),
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  const pm = providerMeta(number?.provider);
  const storedOutboundAuth = Boolean((number?.outbound_trunk ?? number?.provider_config)?.has_auth_credentials);
  const storedInboundAuth = Boolean(number?.inbound_trunk?.has_auth_credentials);

  return (
    <Dialog open={open} onOpenChange={(o) => (!update.isPending ? onOpenChange(o) : undefined)}>
      <DialogContent size={sip ? "lg" : "sm"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono text-base">{number?.phone_number}</span>
            <Badge variant={pm.variant}>{pm.label}</Badge>
          </DialogTitle>
          <DialogDescription>{sip ? "Rename the number or update its SIP trunk settings. Changes apply in ElevenLabs immediately." : "Rename the number. Twilio routing is managed by ElevenLabs."}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Field label="Label" htmlFor={`${id}-label`} error={submitted ? errors.label : undefined}>
              <Input id={`${id}-label`} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} autoFocus />
            </Field>
            <button type="submit" className="hidden" aria-hidden />
          </form>

          {sip ? (
            <>
              {(storedOutboundAuth || storedInboundAuth) && (outboundDirty || inboundDirty) ? (
                <InfoBox tone="warning">ElevenLabs doesn't return stored passwords. Saving trunk changes replaces the whole trunk config, so re-enter the password (or clear the username to drop auth).</InfoBox>
              ) : null}
              <TrunkSection icon={ArrowUpFromLine} title="Outbound trunk" description="Where ElevenLabs sends the calls your agents place.">
                <OutboundTrunkFields value={outbound} onChange={setOutbound} errors={submitted ? errors.outbound : undefined} requireAddress={number?.supports_outbound !== false} storedAuth={storedOutboundAuth} />
              </TrunkSection>
              <TrunkSection icon={ArrowDownToLine} title="Inbound trunk" description="Which addresses and numbers may reach this number." open={inboundOpen} onToggle={() => setInboundOpen((o) => !o)}>
                <InboundTrunkFields value={inbound} onChange={setInbound} errors={submitted ? errors.inbound : undefined} storedAuth={storedInboundAuth} />
              </TrunkSection>
            </>
          ) : null}
        </DialogBody>
        <DialogFooter>
          {dirty ? <span className="mr-auto text-xs text-muted-foreground">{[labelDirty && "label", outboundDirty && "outbound trunk", inboundDirty && "inbound trunk"].filter(Boolean).join(", ")} changed</span> : null}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={update.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={update.isPending} disabled={!dirty}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
