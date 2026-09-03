"use client";
import { Suspense } from "react";
import { PhoneNumbersPage, PhoneNumbersPageSkeleton } from "@/components/phone-numbers/PhoneNumbersPage";

export default function Page() {
  return (
    <Suspense fallback={<PhoneNumbersPageSkeleton />}>
      <PhoneNumbersPage />
    </Suspense>
  );
}
