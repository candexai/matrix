"use client";
import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Password-style input with a show/hide toggle (auth tokens, SIP passwords). */
export const SecretInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input ref={ref} type={show ? "text" : "password"} autoComplete="off" spellCheck={false} className={cn("pr-9 font-mono text-[13px]", className)} {...props} />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide value" : "Show value"} tabIndex={-1} className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
});
SecretInput.displayName = "SecretInput";
