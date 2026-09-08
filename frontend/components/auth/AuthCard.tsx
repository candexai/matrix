import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Shared shell for the sign-in / sign-up cards. */
export function AuthCard({ title, subtitle, children, footer, className }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <Card className={cn("w-full max-w-[440px] p-7 shadow-md animate-fade-up sm:p-9", className)}>
      <div className="mb-7">
        <h1 className="font-heading text-[28px] leading-tight tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children}
      {footer ? <div className="mt-7 border-t border-border pt-5 text-center text-sm text-muted-foreground">{footer}</div> : null}
    </Card>
  );
}

/** Suspense fallback for the auth routes (the forms read `useSearchParams`). */
export function AuthCardSkeleton() {
  return (
    <Card className="w-full max-w-[440px] p-7 sm:p-9" aria-busy>
      <Skeleton className="h-8 w-44" />
      <Skeleton className="mt-3 h-4 w-60" />
      <div className="mt-8 space-y-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </Card>
  );
}
