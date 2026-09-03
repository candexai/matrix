"use client";
import { Suspense } from "react";
import { AnalyticsPage, AnalyticsPageSkeleton } from "@/components/analytics/AnalyticsPage";

export default function Page() {
  return (
    <Suspense fallback={<AnalyticsPageSkeleton />}>
      <AnalyticsPage />
    </Suspense>
  );
}
