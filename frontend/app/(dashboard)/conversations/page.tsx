"use client";
import { Suspense } from "react";
import { ConversationsPage, ConversationsPageSkeleton } from "@/components/conversations/ConversationsPage";

export default function Page() {
  return (
    <Suspense fallback={<ConversationsPageSkeleton />}>
      <ConversationsPage />
    </Suspense>
  );
}
