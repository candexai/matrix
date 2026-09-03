"use client";
import { Check, Copy } from "lucide-react";
import { useState, type MouseEvent } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Tip } from "@/components/ui/tooltip";

export function CopyButton({ value, label = "Copy", className, size = "sm" }: { value: string; label?: string; className?: string; size?: "sm" | "xs" }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };
  return (
    <Tip label={copied ? "Copied" : label}>
      <button
        type="button"
        onClick={onCopy}
        aria-label={label}
        className={cn("inline-flex shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", size === "sm" ? "size-7" : "size-6", className)}
      >
        {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
      </button>
    </Tip>
  );
}
