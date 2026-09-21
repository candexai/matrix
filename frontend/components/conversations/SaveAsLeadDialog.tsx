"use client";
import { useId, useState } from "react";
import { CircleAlert, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useCreateLeadFromConversation, useZohoStatus } from "@/hooks/api";
import { errorCode, errorMessage } from "@/lib/api";
import type { ConversationProfile } from "@/lib/types";
import { formatPhone } from "./helpers";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SaveAsLeadProps {
  conversationId: string;
  phone: string | null;
  /** What the calls already told us — used to pre-fill the form. */
  suggested: ConversationProfile["suggestedLead"];
}

/** Turns an unknown caller into a lead in My Leads and links every call from the same number. */
export function SaveAsLeadDialog({ open, onOpenChange, ...props }: SaveAsLeadProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        {/* The content only mounts while open, so the form re-seeds from the latest suggestions on every open. */}
        <SaveAsLeadForm {...props} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function SaveAsLeadForm({ conversationId, phone, suggested, onDone }: SaveAsLeadProps & { onDone: () => void }) {
  const uid = useId();
  const create = useCreateLeadFromConversation();
  const zohoConnected = Boolean(useZohoStatus().data?.connected);
  const [fullName, setFullName] = useState(suggested.fullName ?? "");
  const [company, setCompany] = useState(suggested.company ?? "");
  const [email, setEmail] = useState(suggested.email ?? "");
  // null = untouched → follows the Zoho connection (same default as "Add lead").
  const [pushChoice, setPushChoice] = useState<boolean | null>(null);
  const [touched, setTouched] = useState(false);
  const pushToZoho = zohoConnected && (pushChoice ?? true);

  const nameError = touched && !fullName.trim() ? "Enter the caller's name" : undefined;
  const emailError = touched && email.trim() && !EMAIL_RE.test(email.trim()) ? "Enter a valid email address" : undefined;
  const serverError = create.isError && errorCode(create.error) !== "ALREADY_LINKED" ? errorMessage(create.error) : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    const name = fullName.trim();
    const mail = email.trim();
    if (!name || (mail && !EMAIL_RE.test(mail))) return;
    create.mutate(
      { id: conversationId, fullName: name, company: company.trim() || undefined, email: mail || undefined, pushToZoho: zohoConnected ? pushToZoho : undefined },
      {
        onSuccess: onDone,
        // Linked meanwhile (e.g. by the post-call sync): the hook refreshes the profile, nothing left to do here.
        onError: (err) => {
          if (errorCode(err) === "ALREADY_LINKED") onDone();
        },
      }
    );
  };

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
      <DialogHeader>
        <DialogTitle>Save as lead</DialogTitle>
        <DialogDescription>{phone ? `Adds ${formatPhone(phone)} to My Leads and links every call from this number.` : "Adds this caller to My Leads and links this call."}</DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-4">
        <Field label="Full name" htmlFor={`${uid}-name`} error={nameError}>
          <Input id={`${uid}-name`} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Priya Sharma" autoFocus autoComplete="off" aria-invalid={Boolean(nameError)} aria-required />
        </Field>
        <Field label="Company" hint="optional" htmlFor={`${uid}-company`}>
          <Input id={`${uid}-company`} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Pvt Ltd" autoComplete="off" />
        </Field>
        <Field label="Email" hint="optional" htmlFor={`${uid}-email`} error={emailError}>
          <Input id={`${uid}-email`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="priya@company.com" autoComplete="off" aria-invalid={Boolean(emailError)} />
        </Field>
        {zohoConnected ? (
          <label htmlFor={`${uid}-zoho`} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border px-3 py-2.5">
            <Checkbox id={`${uid}-zoho`} checked={pushToZoho} onCheckedChange={(v) => setPushChoice(v === true)} className="mt-0.5" />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium leading-5">Also create in Zoho CRM</span>
              <span className="block text-xs text-muted-foreground">Creates the record in Zoho and links it to this lead.</span>
            </span>
          </label>
        ) : null}
        {serverError ? (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
            <CircleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
            <span className="min-w-0 break-words">{serverError}</span>
          </p>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone} disabled={create.isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={create.isPending}>
          {create.isPending ? null : <UserPlus />} Save as lead
        </Button>
      </DialogFooter>
    </form>
  );
}
