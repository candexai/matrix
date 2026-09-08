"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { useChangePassword } from "@/hooks/api";
import { errorMessage } from "@/lib/api";
import { AuthNotice } from "./AuthNotice";
import { PasswordInput } from "./PasswordInput";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";
import { MIN_PASSWORD_LENGTH } from "./passwordStrength";

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const change = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
  };

  const handleOpenChange = (o: boolean) => {
    if (change.isPending) return;
    if (!o) reset();
    onOpenChange(o);
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!current) return setError("Enter your current password.");
    if (next.length < MIN_PASSWORD_LENGTH) return setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    if (next === current) return setError("New password must be different from the current one.");
    if (next !== confirm) return setError("New passwords don't match.");
    setError(null);
    try {
      await change.mutateAsync({ currentPassword: current, newPassword: next });
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="sm">
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>You&apos;ll stay signed in on this device.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label="Current password" htmlFor="pw-current">
              <PasswordInput id="pw-current" autoComplete="current-password" autoFocus value={current} onChange={(e) => setCurrent(e.target.value)} />
            </Field>
            <Field label="New password" htmlFor="pw-next">
              <PasswordInput id="pw-next" autoComplete="new-password" placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`} value={next} onChange={(e) => setNext(e.target.value)} />
              <PasswordStrengthMeter password={next} />
            </Field>
            <Field label="Confirm new password" htmlFor="pw-confirm">
              <PasswordInput id="pw-confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
            {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={change.isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={change.isPending}>
              Update password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
