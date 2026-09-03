"use client";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  count?: number;
  disabled?: boolean;
}

/** Pill row used for channel / view filters (matches the reference "All · Website · WhatsApp…" bar). */
export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: SegmentOption<T>[]; className?: string }) {
  return (
    <div className={cn("inline-flex flex-wrap items-center gap-1 rounded-lg bg-muted/60 p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13.5px] transition-all disabled:opacity-40",
              active ? "border border-border bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {Icon ? <Icon className="size-4" strokeWidth={1.8} /> : null}
            {o.label}
            {typeof o.count === "number" ? <span className={cn("rounded-full px-1.5 text-[11px]", active ? "bg-accent-tint text-primary-hover" : "bg-border/60")}>{o.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
