"use client";
import Link from "next/link";
import { AudioWaveform } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import type { AnalyticsDashboard } from "@/lib/types";
import { formatDuration, formatNumber } from "@/lib/utils";

export function AgentTable({ agents }: { agents: AnalyticsDashboard["agents"] }) {
  const rows = [...agents].sort((a, b) => b.calls - a.calls);
  if (!rows.length) {
    return (
      <EmptyState
        icon={AudioWaveform}
        title="No agent activity"
        description="Calls handled by your voice agents in this period will be ranked here."
        className="py-8"
        action={
          <Link href="/agents" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Go to Voice Agents
          </Link>
        }
      />
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Agent</TableHead>
            <TableHead className="text-right">Calls</TableHead>
            <TableHead className="text-right">Minutes</TableHead>
            <TableHead className="w-[220px]">Success rate</TableHead>
            <TableHead className="text-right">Avg duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((a) => (
            <TableRow key={a.agentId || a.agentName}>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <span className="flex size-7 items-center justify-center rounded-md bg-accent-tint text-primary-hover">
                    <AudioWaveform className="size-3.5" strokeWidth={1.8} />
                  </span>
                  <span className="truncate font-medium">{a.agentName}</span>
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(a.calls)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(Math.round(a.minutes * 10) / 10)}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-success/15">
                    <div className="h-full rounded-full bg-success" style={{ width: `${Math.min(100, Math.max(0, a.successRate))}%` }} />
                  </div>
                  <span className="w-9 text-right text-[13px] tabular-nums">{a.successRate}%</span>
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatDuration(a.avgDurationSecs)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
