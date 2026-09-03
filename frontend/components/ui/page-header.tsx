import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions, className, children }: { title: string; description?: string; actions?: React.ReactNode; className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-4 px-7 pt-7 pb-4", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-[28px] leading-tight">{title}</h1>
          {description ? <p className="mt-1 text-[15px] text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
