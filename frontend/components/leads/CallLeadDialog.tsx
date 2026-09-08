"use client";
import { useEffect, useState } from "react";
import { PhoneCall } from "lucide-react";
import type { Lead, LeadAgentBinding } from "@/lib/types";
import { useAgents, useCallLead, usePhoneNumbers } from "@/hooks/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AgentPicker, AUTO_PHONE, PhonePicker } from "./AgentPhonePickers";
import { isRealListId } from "./leadUtils";

export function CallLeadDialog({ lead, open, onOpenChange, binding, listId, listName }: { lead: Lead | null; open: boolean; onOpenChange: (o: boolean) => void; binding?: LeadAgentBinding | null; listId?: string; listName?: string }) {
  const agents = useAgents();
  const phones = usePhoneNumbers();
  const call = useCallLead();
  const [agentId, setAgentId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState(AUTO_PHONE);

  useEffect(() => {
    if (!open) return;
    setAgentId(binding?.agentId ?? binding?.agent?._id ?? agents.data?.[0]?._id ?? "");
    setPhoneNumberId(binding?.phoneNumberId ?? AUTO_PHONE);
  }, [open, binding, agents.data]);

  const to = lead?.phone || lead?.mobile;
  const boundLabel = binding?.inherited ? "default agent" : isRealListId(listId) && listName ? `attached to ${listName}` : "default agent";
  const submit = () => {
    if (!lead) return;
    call.mutate({ id: lead._id, agentId: agentId || undefined, phoneNumberId: phoneNumberId === AUTO_PHONE ? undefined : phoneNumberId, listId: isRealListId(listId) ? listId : undefined }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Call {lead?.fullName ?? "lead"}</DialogTitle>
          <DialogDescription>{to ? `The agent will dial ${to} and collect the configured fields.` : "This lead has no phone number on file."}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <AgentPicker agents={agents.data} loading={agents.isLoading} error={agents.error} value={agentId} onChange={setAgentId} boundAgentId={binding?.agentId} boundLabel={boundLabel} />
          <PhonePicker numbers={phones.data} loading={phones.isLoading} error={phones.error} value={phoneNumberId} onChange={setPhoneNumberId} />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} loading={call.isPending} disabled={!lead || !to || !agentId}>
            <PhoneCall /> Call now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
