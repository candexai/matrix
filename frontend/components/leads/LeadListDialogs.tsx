"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ListPlus, Pencil } from "lucide-react";
import type { LeadList } from "@/lib/types";
import { useCreateLeadList, useUpdateLeadList } from "@/hooks/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/** Create a manual lead table. Opens the new table on success. */
export function NewListDialog({ open, onOpenChange, openAfterCreate = true }: { open: boolean; onOpenChange: (o: boolean) => void; openAfterCreate?: boolean }) {
  const router = useRouter();
  const create = useCreateLeadList();
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setName("");
  }, [open]);

  const valid = name.trim().length > 0;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    create.mutate(
      { name: name.trim() },
      {
        onSuccess: (list) => {
          onOpenChange(false);
          if (openAfterCreate) router.push(`/leads/${list._id}`);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>New list</DialogTitle>
            <DialogDescription>A manual lead table. Add leads to it by hand, then attach a voice agent to call them.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Hot leads — September" maxLength={120} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending} disabled={!valid}>
              <ListPlus /> Create list
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Rename a manual lead table. */
export function RenameListDialog({ list, open, onOpenChange }: { list: LeadList | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const update = useUpdateLeadList();
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setName(list?.name ?? "");
  }, [open, list]);

  const valid = name.trim().length > 0 && name.trim() !== list?.name;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!list || !valid) return;
    update.mutate({ id: list._id, name: name.trim() }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Rename list</DialogTitle>
            <DialogDescription>Only the name changes — leads and the attached agent stay as they are.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={120} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={update.isPending} disabled={!valid}>
              <Pencil /> Rename
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
