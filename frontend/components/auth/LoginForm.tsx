"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuthStatus, useLogin } from "@/hooks/api";
import { errorMessage } from "@/lib/api";
import { AuthCard } from "./AuthCard";
import { AuthNotice } from "./AuthNotice";
import { PasswordInput } from "./PasswordInput";
import { safeNext } from "./safeNext";
import { useRedirectIfSignedIn } from "./useRedirectIfSignedIn";

/** Reads `?next=` — wrap in <Suspense> at the page level. */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const redirecting = useRedirectIfSignedIn(next);
  const status = useAuthStatus();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const noAccounts = status.data?.hasAccounts === false;

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setError(null);
    try {
      await login.mutateAsync({ email: email.trim(), password });
      router.replace(next);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <AuthCard
      title="Sign in"
      subtitle="Welcome back to your workspace."
      footer={
        <>
          New to Matrix?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {noAccounts ? (
        <AuthNotice
          tone="brand"
          className="mb-5"
          action={
            <Link href="/signup" className={buttonVariants({ size: "sm" })}>
              Create the first account
            </Link>
          }
        >
          No accounts yet — create the first one (it will own this workspace).
        </AuthNotice>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Email" htmlFor="login-email">
          <Input id="login-email" type="email" autoComplete="email" autoFocus placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="login-password">
          <PasswordInput id="login-password" autoComplete="current-password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}
        <Button type="submit" size="lg" className="w-full" loading={login.isPending || redirecting}>
          {redirecting ? "Redirecting…" : "Sign in"}
        </Button>
      </form>
    </AuthCard>
  );
}
