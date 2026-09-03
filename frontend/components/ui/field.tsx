import { Label } from "./label";
import { cn } from "@/lib/utils";

/** Label + control + help text stack used throughout forms. */
export function Field({ label, hint, help, error, htmlFor, className, children, inline }: { label: React.ReactNode; hint?: string; help?: React.ReactNode; error?: string; htmlFor?: string; className?: string; children: React.ReactNode; inline?: boolean }) {
  if (inline) {
    return (
      <div className={cn("flex items-start justify-between gap-6 py-3", className)}>
        <div className="min-w-0">
          <Label htmlFor={htmlFor} hint={hint}>{label}</Label>
          {help ? <p className="mt-1 text-xs text-muted-foreground">{help}</p> : null}
          {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
        </div>
        <div className="shrink-0">{children}</div>
      </div>
    );
  }
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} hint={hint}>{label}</Label>
      {children}
      {help ? <p className="text-xs text-muted-foreground">{help}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
