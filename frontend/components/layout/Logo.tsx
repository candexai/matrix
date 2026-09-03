import Image from "next/image";
import { APP_NAME, APP_PARTNER, CANDEX_LOGO_SRC } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** "Matrix × CandexAI" lockup. */
export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative flex size-9 shrink-0 items-center justify-center rounded-lg brand-gradient text-white shadow-sm">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19V5l8 8 8-8v14" />
        </svg>
      </div>
      {!compact ? (
        <div className="flex min-w-0 items-baseline gap-1.5 leading-none">
          <span className="font-heading text-[22px] tracking-tight">{APP_NAME}</span>
          <span className="text-[13px] text-muted-foreground">×</span>
          <span className="inline-flex items-center gap-1">
            <Image src={CANDEX_LOGO_SRC} alt="" width={16} height={16} className="size-4 rounded-sm object-contain" />
            <span className="font-heading text-[15px] text-muted-foreground">{APP_PARTNER}</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
