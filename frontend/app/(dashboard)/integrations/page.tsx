"use client";
import { Suspense } from "react";
import { IntegrationsPage } from "@/components/integrations/IntegrationsPage";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

function Fallback() {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Integrations" description="Connect your CRM, voice provider and channels." />
      <div className="grid gap-4 px-7 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Fallback />}>
      <IntegrationsPage />
    </Suspense>
  );
}
