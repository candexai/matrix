import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({ icon: Icon, title, description, action, className }: { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-16 text-center animate-fade-in", className)}>
      <div className="mb-4 flex size-[76px] items-center justify-center rounded-2xl border border-border bg-muted/50">
        <Icon className="size-7 text-primary" strokeWidth={1.6} />
      </div>
      <h3 className="font-heading text-[17px]">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
