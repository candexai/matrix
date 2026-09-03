import type { ReactNode } from "react";
import { Info, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function InfoBox({ icon: Icon = Info, title, children, className, tone = "neutral" }: { icon?: LucideIcon; title?: ReactNode; children: ReactNode; className?: string; tone?: "neutral" | "warning" }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border p-3.5 text-xs leading-5",
        tone === "neutral" && "border-border bg-muted/40 text-muted-foreground",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200",
        className
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", tone === "neutral" && "text-primary")} />
      <div className="min-w-0 flex-1">
        {title ? <div className={cn("mb-0.5 font-medium", tone === "neutral" && "text-foreground")}>{title}</div> : null}
        {children}
      </div>
    </div>
  );
}
