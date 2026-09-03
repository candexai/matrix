"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AgentForm } from "@/components/agents/AgentForm";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export default function NewAgentPage() {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="New voice agent"
        description="Configure how the agent sounds, what it says and what it collects. Saved straight to ElevenLabs."
        actions={
          <Link href="/agents" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <ArrowLeft /> All agents
          </Link>
        }
      />
      <AgentForm mode="create" />
    </div>
  );
}
