import type { ReactNode } from "react";
import { AlertCircle, Info, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** Inline message box for auth forms: server errors, first-run hints, workspace notes. */
export function AuthNotice({ tone = "info", children, action, className }: { tone?: "error" | "info" | "brand"; children: ReactNode; action?: ReactNode; className?: string }) {
  const Icon = tone === "error" ? AlertCircle : tone === "brand" ? Sparkles : Info;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm leading-snug",
        tone === "error" && "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200",
        tone === "info" && "border-border bg-muted/60 text-foreground",
        tone === "brand" && "border-primary/30 bg-accent-tint text-foreground",
        className
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", tone === "error" ? "text-red-600 dark:text-red-300" : "text-primary")} />
      <div className="min-w-0 flex-1">
        <div>{children}</div>
        {action ? <div className="mt-2.5">{action}</div> : null}
      </div>
    </div>
  );
}
