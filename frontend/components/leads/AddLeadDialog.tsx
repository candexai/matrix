"use client";
import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { useAddLeadsToList, useCreateLead } from "@/hooks/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { StatusPicker } from "./StatusPicker";
import { isRealListId } from "./leadUtils";

const empty = { firstName: "", lastName: "", phone: "", email: "", company: "", leadStatus: "", city: "" };

export function AddLeadDialog({
  open,
  onOpenChange,
  statuses,
  zohoConnected,
  listId,
  listName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  statuses: string[];
  zohoConnected: boolean;
  /** Manual list to put the new lead into (ignored for "all" / Zoho views). */
  listId?: string;
  listName?: string;
}) {
  const create = useCreateLead();
  const addToList = useAddLeadsToList();
  const [form, setForm] = useState(empty);
  const [pushToZoho, setPushToZoho] = useState(false);
  const targetList = isRealListId(listId) ? listId : undefined;

  useEffect(() => {
    if (open) {
      setForm(empty);
      setPushToZoho(zohoConnected);
    }
  }, [open, zohoConnected]);

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = Boolean(form.firstName.trim() || form.lastName.trim());
  const pending = create.isPending || addToList.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const payload: Record<string, unknown> = { pushToZoho: pushToZoho && zohoConnected };
    for (const [k, v] of Object.entries(form)) if (v.trim()) payload[k] = v.trim();
    create.mutate(payload, {
      onSuccess: (lead) => {
        if (targetList) addToList.mutate({ id: targetList, leadIds: [lead._id] }, { onSettled: () => onOpenChange(false) });
        else onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>{targetList && listName ? `Add lead to ${listName}` : "Add lead"}</DialogTitle>
            <DialogDescription>{targetList ? "Create a lead and put it in this list. You can push it to Zoho CRM at the same time." : "Create a lead manually. You can push it to Zoho CRM at the same time."}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name">
                <Input value={form.firstName} onChange={set("firstName")} autoFocus placeholder="Priya" />
              </Field>
              <Field label="Last name">
                <Input value={form.lastName} onChange={set("lastName")} placeholder="Sharma" />
              </Field>
              <Field label="Phone">
                <Input value={form.phone} onChange={set("phone")} placeholder="+91 98765 43210" inputMode="tel" />
              </Field>
              <Field label="Email">
                <Input value={form.email} onChange={set("email")} placeholder="priya@company.com" type="email" />
              </Field>
              <Field label="Company">
                <Input value={form.company} onChange={set("company")} placeholder="Acme Pvt Ltd" />
              </Field>
              <Field label="City">
                <Input value={form.city} onChange={set("city")} placeholder="Bengaluru" />
              </Field>
              <Field label="Status" className="col-span-2">
                <StatusPicker value={form.leadStatus} onChange={(v) => setForm((f) => ({ ...f, leadStatus: v }))} options={statuses} placeholder="Not Contacted" />
              </Field>
            </div>
            <Field inline label="Also create in Zoho" help={zohoConnected ? "Creates the record in Zoho CRM and links it to this lead." : "Connect Zoho in Integrations to enable."} className="rounded-lg border border-border px-4 py-2">
              <Switch checked={pushToZoho && zohoConnected} onCheckedChange={setPushToZoho} disabled={!zohoConnected} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={!valid}>
              <UserPlus /> Add lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
