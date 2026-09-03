"use client";
import { Suspense } from "react";
import { useParams } from "next/navigation";
import { LeadsTableView } from "@/components/leads/LeadsTableView";
import { Skeleton } from "@/components/ui/skeleton";

function Fallback() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="px-7 pt-6">
        <Skeleton className="h-3.5 w-40" />
      </div>
      <div className="px-7 pb-4 pt-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>
      <div className="space-y-3 px-7">
        <Skeleton className="h-[74px] w-full rounded-xl" />
        <Skeleton className="h-9 w-full max-w-xl" />
        <Skeleton className="h-[420px] w-full rounded-xl" />
      </div>
    </div>
  );
}

export default function Page() {
  const { listId } = useParams<{ listId: string }>();
  return (
    <Suspense fallback={<Fallback />}>
      <LeadsTableView listId={listId} />
    </Suspense>
  );
}
