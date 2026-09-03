"use client";
import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

const Label = React.forwardRef<React.ComponentRef<typeof LabelPrimitive.Root>, React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & { hint?: string }>(
  ({ className, hint, children, ...props }, ref) => (
    <LabelPrimitive.Root ref={ref} className={cn("text-[13px] font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)} {...props}>
      {children}
      {hint ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">{hint}</span> : null}
    </LabelPrimitive.Root>
  )
);
Label.displayName = "Label";

export { Label };
