"use client";
import { useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuthStatus, useSignup } from "@/hooks/api";
import { errorMessage } from "@/lib/api";
import { AuthCard } from "./AuthCard";
import { AuthNotice } from "./AuthNotice";
import { PasswordInput } from "./PasswordInput";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";
import { MIN_PASSWORD_LENGTH } from "./passwordStrength";
import { DEFAULT_AFTER_AUTH } from "./safeNext";
import { useRedirectIfSignedIn } from "./useRedirectIfSignedIn";

// Mirrors the backend's check so we fail fast with the same rule.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface FormState {
  name: string;
  company: string;
  email: string;
  password: string;
  confirm: string;
}
type FieldErrors = Partial<Record<keyof FormState, string>>;

const EMPTY: FormState = { name: "", company: "", email: "", password: "", confirm: "" };

function validate(f: FormState): FieldErrors {
  const errs: FieldErrors = {};
  if (!f.name.trim()) errs.name = "Enter your name.";
  if (!EMAIL_RE.test(f.email.trim())) errs.email = "Enter a valid email address.";
  if (f.password.length < MIN_PASSWORD_LENGTH) errs.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (f.confirm !== f.password) errs.confirm = "Passwords don't match.";
  return errs;
}

export function SignupForm() {
  const router = useRouter();
  const redirecting = useRedirectIfSignedIn(DEFAULT_AFTER_AUTH);
  const status = useAuthStatus();
  const signup = useSignup();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const hasAccounts = status.data?.hasAccounts;

  const bind = (key: keyof FormState) => ({
    value: form[key],
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setForm((f) => ({ ...f, [key]: value }));
      if (fieldErrors[key]) setFieldErrors((fe) => ({ ...fe, [key]: undefined }));
    },
  });

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errs = validate(form);
    setFieldErrors(errs);
    setError(null);
    if (Object.keys(errs).length) return;
    try {
      await signup.mutateAsync({ name: form.name.trim(), email: form.email.trim(), password: form.password, company: form.company.trim() || undefined });
      router.replace(DEFAULT_AFTER_AUTH);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <AuthCard
      title="Create your account"
      subtitle="Set up a workspace for your voice agents and leads."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {hasAccounts === true ? (
        <AuthNotice tone="info" className="mb-5">
          Creating a new account gives you a separate, empty workspace. If your team already uses Matrix,{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            sign in
          </Link>{" "}
          instead.
        </AuthNotice>
      ) : null}
      {hasAccounts === false ? (
        <AuthNotice tone="brand" className="mb-5">
          You&apos;re first — this account will own the existing workspace and everything already in it.
        </AuthNotice>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="signup-name" error={fieldErrors.name}>
            <Input id="signup-name" autoComplete="name" autoFocus placeholder="Your name" {...bind("name")} />
          </Field>
          <Field label="Company" hint="optional" htmlFor="signup-company">
            <Input id="signup-company" autoComplete="organization" placeholder="Workspace name" {...bind("company")} />
          </Field>
        </div>
        <Field label="Email" htmlFor="signup-email" error={fieldErrors.email}>
          <Input id="signup-email" type="email" autoComplete="email" placeholder="you@company.com" {...bind("email")} />
        </Field>
        <Field label="Password" htmlFor="signup-password" error={fieldErrors.password}>
          <PasswordInput id="signup-password" autoComplete="new-password" placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`} {...bind("password")} />
          <PasswordStrengthMeter password={form.password} />
        </Field>
        <Field label="Confirm password" htmlFor="signup-confirm" error={fieldErrors.confirm}>
          <PasswordInput id="signup-confirm" autoComplete="new-password" placeholder="Repeat your password" {...bind("confirm")} />
        </Field>
        {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}
        <Button type="submit" size="lg" className="w-full" loading={signup.isPending || redirecting}>
          {redirecting ? "Redirecting…" : "Create account"}
        </Button>
      </form>
    </AuthCard>
  );
}
