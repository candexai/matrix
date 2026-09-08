import { cn } from "@/lib/utils";
import { passwordStrength } from "./passwordStrength";

const BAR = ["", "bg-red-500", "bg-amber-500", "bg-emerald-500", "bg-emerald-600"];
const TEXT = ["", "text-red-600 dark:text-red-400", "text-amber-600 dark:text-amber-400", "text-emerald-600 dark:text-emerald-400", "text-emerald-600 dark:text-emerald-400"];

/** Four-segment strength bar + one-line hint, driven by `passwordStrength`. */
export function PasswordStrengthMeter({ password, className }: { password: string; className?: string }) {
  const s = passwordStrength(password);
  return (
    <div className={cn("space-y-1.5", className)} aria-live="polite">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn("h-1 flex-1 rounded-full bg-muted transition-colors", i <= s.score && BAR[s.score])} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {s.label ? <span className={cn("font-medium", TEXT[s.score])}>{s.label}</span> : null}
        {s.label ? " · " : null}
        {s.hint}
      </p>
    </div>
  );
}
