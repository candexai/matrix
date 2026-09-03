import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap [&_svg]:size-3", {
  variants: {
    variant: {
      default: "border-transparent bg-primary text-primary-foreground",
      soft: "border-transparent bg-accent-tint text-primary-hover",
      secondary: "border-transparent bg-muted text-foreground",
      outline: "border-border text-foreground",
      success: "border-transparent bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
      warning: "border-transparent bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
      destructive: "border-transparent bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
      info: "border-transparent bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
      violet: "border-transparent bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
    },
  },
  defaultVariants: { variant: "secondary" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
