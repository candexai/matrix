"use client";
import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/hooks/api";
import { errorMessage } from "@/lib/api";

function statusOf(err: unknown): number | undefined {
  return (err as { status?: number } | null | undefined)?.status;
}

/** Where to send a signed-out visitor so they land back here after signing in. */
function loginUrl(): string {
  const here = window.location.pathname + window.location.search;
  return `/login?next=${encodeURIComponent(here)}`;
}

function AuthGateSkeleton() {
  return (
    <div className="flex flex-1 flex-col px-7 py-6 animate-fade-in" aria-busy>
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin text-primary" />
        Checking your session…
      </div>
    </div>
  );
}

/**
 * Gate for every dashboard page: renders children once `/auth/me` succeeds, bounces to `/login?next=…` on 401,
 * and shows a retry panel for anything else (backend down) instead of kicking the user out.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const me = useMe();
  const unauthenticated = me.isError && statusOf(me.error) === 401;

  useEffect(() => {
    if (unauthenticated) router.replace(loginUrl());
  }, [unauthenticated, router]);

  if (me.data) return <>{children}</>;

  if (me.isError && !unauthenticated) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Couldn't check your session"
        description={errorMessage(me.error)}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => me.refetch()} loading={me.isFetching}>
              Try again
            </Button>
            <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
              Go to sign in
            </Link>
          </div>
        }
        className="flex-1"
      />
    );
  }

  return <AuthGateSkeleton />;
}
