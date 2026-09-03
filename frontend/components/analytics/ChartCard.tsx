"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ChartCard({ title, subtitle, right, className, bodyClassName, children }: { title: string; subtitle?: string; right?: React.ReactNode; className?: string; bodyClassName?: string; children: React.ReactNode }) {
  return (
    <Card className={cn("flex min-w-0 flex-col", className)}>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {subtitle ? <CardDescription className="mt-0.5 text-[13px]">{subtitle}</CardDescription> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </CardHeader>
      <CardContent className={cn("min-w-0 flex-1", bodyClassName)}>{children}</CardContent>
    </Card>
  );
}
