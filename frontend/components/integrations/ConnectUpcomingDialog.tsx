"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Clock3, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { BrandIcon } from "./BrandIcons";
import { INTEGRATION_DESCRIPTIONS } from "./integrationCopy";

/** What connecting will give you + how the (upcoming) connect step works, per integration. */
const UPCOMING_COPY: Record<string, { benefits: string[]; how: string }> = {
  hubspot: { benefits: ["Pull HubSpot contacts and deals into My Leads", "Write call outcomes and collected answers back to HubSpot", "Call a HubSpot list with one click"], how: "Sign in with HubSpot and choose which lists to sync." },
  salesforce: { benefits: ["Sync Salesforce leads and list views into My Leads", "Push call summaries and filled fields back to Salesforce", "Keep lead status in step with call outcomes"], how: "Sign in with Salesforce and pick the list views to sync." },
  pipedrive: { benefits: ["Import Pipedrive persons and deals for outbound calling", "Log every call as an activity on the deal", "Fill missing person fields from the conversation"], how: "Sign in with Pipedrive and choose the pipelines to import." },
  twilio: { benefits: ["Use your own Twilio numbers for inbound and outbound calls", "Keep billing and compliance in your Twilio account", "Assign each number to a voice agent"], how: "Paste your Twilio Account SID and auth token, then pick the numbers." },
  website: { benefits: ["Add a chat and voice widget to your website", "Visitors talk to the same agent that calls your leads", "Every chat lands in Conversations with a summary"], how: "Copy one script tag into your site and choose the agent that answers." },
  whatsapp: { benefits: ["Agents reply to leads on WhatsApp Business", "Send follow-ups and documents after a call", "WhatsApp chats appear in Conversations next to calls"], how: "Sign in with Meta, pick your WhatsApp Business number and the agent that replies." },
  instagram: { benefits: ["Answer Instagram DMs with an AI agent", "Turn DM enquiries into leads automatically", "Hand over to a human when the agent is unsure"], how: "Sign in with Meta and choose the Instagram account to connect." },
  facebook: { benefits: ["Reply to Messenger conversations with an AI agent", "Capture lead details from ad enquiries", "All threads in Conversations with summaries"], how: "Sign in with Meta and choose the Facebook Page to connect." },
  telegram: { benefits: ["Run a Telegram bot backed by your voice agent’s knowledge", "Answer FAQs and collect lead details in chat", "Threads show up in Conversations"], how: "Create a bot with BotFather and paste its token." },
  email: { benefits: ["Send follow-up emails automatically after calls", "Reply to inbound mail with an AI agent", "Email threads next to calls on the lead’s timeline"], how: "Connect your mailbox and choose the sender address." },
  "google-calendar": { benefits: ["Agents book meetings straight into Google Calendar", "Offer only the slots that are really free", "Send invites to the lead automatically"], how: "Sign in with Google and pick the calendar agents can book into." },
  calendly: { benefits: ["Agents offer your Calendly links during calls", "Bookings are recorded on the lead", "Different event types per agent"], how: "Sign in with Calendly and choose the event types to offer." },
  slack: { benefits: ["Post call summaries and hot leads to Slack channels", "Alert the team when a caller asks for a human", "Daily digest of outcomes"], how: "Add the app to your Slack workspace and pick the channels." },
};

export interface UpcomingRequestState {
  requested: boolean;
  requestedAt?: string | null;
}

/**
 * "Connect" for an integration that is not live yet: explains what it will do and records an
 * access request for this workspace (POST/DELETE /integrations/:id/request) — nothing is connected.
 */
export function ConnectUpcomingDialog({ id, name, state, open, onOpenChange }: { id: string; name: string; state: UpcomingRequestState; open: boolean; onOpenChange: (open: boolean) => void }) {
  const qc = useQueryClient();
  const copy = UPCOMING_COPY[id];

  const request = useMutation({
    mutationFn: () => api.post<UpcomingRequestState>(`/integrations/${encodeURIComponent(id)}/request`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integrations"] });
      toast.success(`${name} requested for this workspace`, { description: "The Candex team will switch it on for this workspace." });
      onOpenChange(false);
    },
  });
  const withdraw = useMutation({
    mutationFn: () => api.delete<UpcomingRequestState>(`/integrations/${encodeURIComponent(id)}/request`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integrations"] });
      toast.message(`Request for ${name} withdrawn`);
      onOpenChange(false);
    },
  });
  const busy = request.isPending || withdraw.isPending;
  const error = request.error ?? withdraw.error;

  return (
    <Dialog open={open} onOpenChange={(o) => (busy ? undefined : onOpenChange(o))}>
      <DialogContent size="md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <BrandIcon id={id} />
            <div className="min-w-0">
              <DialogTitle>Connect {name}</DialogTitle>
              <DialogDescription>{INTEGRATION_DESCRIPTIONS[id] ?? "Connect this integration to your workspace."}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogBody className="space-y-5">
          {copy ? (
            <div>
              <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">What you’ll get</div>
              <ul className="space-y-1.5 text-[13.5px]">
                {copy.benefits.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2} />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[13px] text-muted-foreground">
                <span className="font-medium text-foreground">How it connects:</span> {copy.how}
              </p>
            </div>
          ) : null}

          <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 p-3.5 text-[13px] leading-6">
            <Clock3 className="mt-1 size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
            {state.requested ? (
              <p>
                <span className="font-medium">Requested{state.requestedAt ? ` on ${formatDateTime(state.requestedAt)}` : ""}.</span> {name} is in early access — the Candex team will switch it on for this workspace and it will show as ready to connect here.
              </p>
            ) : (
              <p>
                {name} is in early access. Request it and the Candex team will switch it on for this workspace — nothing is connected or shared until you complete the sign-in step.
              </p>
            )}
          </div>

          {error ? (
            <p role="alert" className="text-[13px] text-destructive">
              {errorMessage(error)}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          {state.requested ? (
            <>
              <Button variant="ghost" onClick={() => withdraw.mutate()} loading={withdraw.isPending} disabled={busy} className="mr-auto text-muted-foreground">
                {withdraw.isPending ? null : <Undo2 />} Withdraw request
              </Button>
              <Button onClick={() => onOpenChange(false)} disabled={busy}>
                Done
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={() => request.mutate()} loading={request.isPending}>
                Request access
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
