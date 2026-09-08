"use client";
import { useEffect, useState } from "react";
import { PhoneOutgoing } from "lucide-react";
import type { LeadAgentBinding } from "@/lib/types";
import { useAgents, useBatchCall, usePhoneNumbers } from "@/hooks/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AgentPicker, AUTO_PHONE, PhonePicker } from "./AgentPhonePickers";
import { isRealListId } from "./leadUtils";

function defaultBatchName(listName?: string) {
  const d = new Date();
  return `${listName || "My Leads"} · ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
}

export function BatchCallDialog({
  leadIds,
  open,
  onOpenChange,
  binding,
  onSubmitted,
  listId,
  listName,
}: {
  leadIds: string[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  binding?: LeadAgentBinding | null;
  onSubmitted?: () => void;
  /** Table the selection came from — its binding is the default agent and is passed to the backend. */
  listId?: string;
  listName?: string;
}) {
  const agents = useAgents();
  const phones = usePhoneNumbers();
  const batch = useBatchCall();
  const [agentId, setAgentId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState(AUTO_PHONE);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) return;
    setAgentId(binding?.agentId ?? binding?.agent?._id ?? agents.data?.[0]?._id ?? "");
    setPhoneNumberId(binding?.phoneNumberId ?? AUTO_PHONE);
    setName(defaultBatchName(listName));
  }, [open, binding, agents.data, listName]);

  const boundLabel = binding?.inherited ? "default agent" : isRealListId(listId) && listName ? `attached to ${listName}` : "default agent";
  const submit = () => {
    batch.mutate(
      { leadIds, agentId: agentId || undefined, phoneNumberId: phoneNumberId === AUTO_PHONE ? undefined : phoneNumberId, callName: name.trim() || undefined, listId: isRealListId(listId) ? listId : undefined },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSubmitted?.();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>
            Call {leadIds.length} selected lead{leadIds.length === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>
            Submits an ElevenLabs batch call{listName ? ` from “${listName}”` : ""}. Leads without a phone number are skipped.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <AgentPicker agents={agents.data} loading={agents.isLoading} error={agents.error} value={agentId} onChange={setAgentId} boundAgentId={binding?.agentId} boundLabel={boundLabel} />
          <PhonePicker numbers={phones.data} loading={phones.isLoading} error={phones.error} value={phoneNumberId} onChange={setPhoneNumberId} />
          <Field label="Batch name" hint="optional">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={defaultBatchName(listName)} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} loading={batch.isPending} disabled={!agentId || !leadIds.length}>
            <PhoneOutgoing /> Start batch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
